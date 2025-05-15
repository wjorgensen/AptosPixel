"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const models_1 = require("./models");
const aptos_1 = require("aptos");
const sequelize_1 = require("sequelize");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// Aptos client setup
const aptosClient = new aptos_1.AptosClient(process.env.APTOS_NODE_URL || 'https://fullnode.mainnet.aptoslabs.com/v1');
const CONTRACT_ADDRESS = process.env.APTOS_CONTRACT_ADDRESS || '0x1';
const MODULE_NAME = 'PixelBoard';
const WIDTH = 1000;
const HEIGHT = 1000;
// Utility function to convert from 1D contract coordinate to 2D grid coordinates
function convertToXY(id) {
    return {
        x: id % WIDTH,
        y: Math.floor(id / WIDTH)
    };
}
// Utility function to convert argb hex value to CSS color
function argbToHex(argb) {
    // Remove 0x prefix if it exists
    const cleanArgb = argb.startsWith('0x') ? argb.substring(2) : argb;
    // ARGB format is 0xAARRGGBB, but we want #RRGGBB for CSS
    const r = cleanArgb.substring(2, 4);
    const g = cleanArgb.substring(4, 6);
    const b = cleanArgb.substring(6, 8);
    return `#${r}${g}${b}`;
}
// Function to decode UTF-8 encoded bytes to a string
function decodeLink(bytes) {
    try {
        // Remove 0x prefix and convert hex pairs to bytes
        const hexString = bytes.startsWith('0x') ? bytes.substring(2) : bytes;
        // Convert hex to bytes
        const byteArray = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        // Decode bytes to string
        return new TextDecoder().decode(byteArray);
    }
    catch (error) {
        console.error('Error decoding link:', error);
        return '';
    }
}
// Initialize the database and create tables
async function initializeDatabase() {
    try {
        // Test database connection
        await models_1.sequelize.authenticate();
        console.log('Connected to PostgreSQL database');
        // Sync all models (create tables if they don't exist)
        await models_1.sequelize.sync();
        console.log('Database synchronized');
        // Check if we need to initialize the grid with default values
        const pixelCount = await models_1.Pixel.count();
        if (pixelCount === 0) {
            console.log('Initializing pixel grid with default values...');
            // Create default pixels in batches to avoid memory issues
            const batchSize = 1000;
            for (let x = 0; x < WIDTH; x++) {
                const pixelsToCreate = [];
                for (let y = 0; y < HEIGHT; y++) {
                    pixelsToCreate.push({
                        x,
                        y,
                        color: '#FFFFFF',
                        url: '',
                        owner: ''
                    });
                    // Insert in batches
                    if (pixelsToCreate.length >= batchSize || y === HEIGHT - 1) {
                        await models_1.Pixel.bulkCreate(pixelsToCreate);
                        pixelsToCreate.length = 0;
                    }
                }
            }
            console.log('Pixel grid initialized with default values');
        }
    }
    catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}
// Function to handle pixel bought events
async function handlePixelBought(event) {
    try {
        const { id, owner, argb, link } = event;
        const coords = convertToXY(parseInt(id));
        const { x, y } = coords;
        const hexColor = argbToHex(argb);
        const url = decodeLink(link);
        // Find the pixel or create it if it doesn't exist
        const [pixel, created] = await models_1.Pixel.findOrCreate({
            where: { x, y },
            defaults: {
                color: hexColor,
                url: url,
                owner: owner
            }
        });
        // If pixel already exists, update it
        if (!created) {
            await pixel.update({
                color: hexColor,
                url: url,
                owner: owner
            });
        }
        console.log(`Pixel bought at (${x}, ${y}) by ${owner}`);
    }
    catch (error) {
        console.error('Error handling pixel bought event:', error);
    }
}
// Function to handle pixel updated events
async function handlePixelUpdated(event) {
    try {
        const { id, owner, argb, link } = event;
        const coords = convertToXY(parseInt(id));
        const { x, y } = coords;
        const hexColor = argbToHex(argb);
        const url = decodeLink(link);
        // Update the pixel
        const [updatedRowsCount] = await models_1.Pixel.update({
            color: hexColor,
            url: url,
            owner: owner
        }, {
            where: { x, y }
        });
        if (updatedRowsCount > 0) {
            console.log(`Pixel updated at (${x}, ${y}) by ${owner}`);
        }
        else {
            console.log(`Pixel not found for update at (${x}, ${y})`);
        }
    }
    catch (error) {
        console.error('Error handling pixel updated event:', error);
    }
}
// Function to start listening to contract events
async function startEventListener(startVersion = BigInt(0)) {
    try {
        console.log(`Starting event listener from version ${startVersion}`);
        let currentVersion = startVersion;
        // Function to poll for events
        async function pollEvents() {
            try {
                // Get PixelBoughtEvent events
                const buyEvents = await aptosClient.getEventsByEventHandle(CONTRACT_ADDRESS, `${CONTRACT_ADDRESS}::${MODULE_NAME}::Board`, 'buy_events', {
                    start: Number(currentVersion),
                    limit: 100
                });
                // Get PixelUpdatedEvent events
                const updateEvents = await aptosClient.getEventsByEventHandle(CONTRACT_ADDRESS, `${CONTRACT_ADDRESS}::${MODULE_NAME}::Board`, 'update_events', {
                    start: Number(currentVersion),
                    limit: 100
                });
                // Process buy events
                for (const event of buyEvents) {
                    await handlePixelBought(event.data);
                    currentVersion = BigInt(event.sequence_number) + BigInt(1);
                }
                // Process update events
                for (const event of updateEvents) {
                    await handlePixelUpdated(event.data);
                    currentVersion = BigInt(event.sequence_number) + BigInt(1);
                }
                if (buyEvents.length > 0 || updateEvents.length > 0) {
                    console.log(`Processed ${buyEvents.length} buy events and ${updateEvents.length} update events`);
                }
                // Store the current version in database
                await models_1.sequelize.query('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT)');
                await models_1.sequelize.query('INSERT INTO app_state (key, value) VALUES (\'lastProcessedVersion\', :value) ON CONFLICT (key) DO UPDATE SET value = :value', {
                    replacements: { value: currentVersion.toString() },
                    type: 'RAW'
                });
            }
            catch (error) {
                console.error('Error polling events:', error);
            }
            // Poll again after a delay
            setTimeout(pollEvents, 10000); // Poll every 10 seconds
        }
        // Start polling
        pollEvents();
    }
    catch (error) {
        console.error('Error starting event listener:', error);
        const localVersion = startVersion;
        setTimeout(() => startEventListener(localVersion), 30000); // Retry after 30 seconds
    }
}
// Backfill historical data (can be run on startup or as needed)
async function backfillHistoricalData() {
    try {
        console.log('Starting historical data backfill...');
        // Get all historical PixelBoughtEvent events
        const buyEvents = await aptosClient.getEventsByEventHandle(CONTRACT_ADDRESS, `${CONTRACT_ADDRESS}::${MODULE_NAME}::Board`, 'buy_events', { limit: 10000 } // Adjust as needed
        );
        // Process buy events
        for (const event of buyEvents) {
            await handlePixelBought(event.data);
        }
        // Get all historical PixelUpdatedEvent events
        const updateEvents = await aptosClient.getEventsByEventHandle(CONTRACT_ADDRESS, `${CONTRACT_ADDRESS}::${MODULE_NAME}::Board`, 'update_events', { limit: 10000 } // Adjust as needed
        );
        // Process update events
        for (const event of updateEvents) {
            await handlePixelUpdated(event.data);
        }
        console.log(`Backfill complete. Processed ${buyEvents.length} buy events and ${updateEvents.length} update events`);
    }
    catch (error) {
        console.error('Error during historical data backfill:', error);
    }
}
// API Routes
// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await models_1.sequelize.authenticate();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            version: process.env.npm_package_version || '1.0.0'
        });
    }
    catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'error'
        });
    }
});
// Get the entire grid
app.get('/api/grid', async (req, res) => {
    try {
        // Rather than getting the entire grid at once, we can paginate
        // or limit the response size for better performance
        const pixels = await models_1.Pixel.findAll({
            attributes: ['x', 'y', 'color', 'url', 'owner'],
            where: {
                // Only return non-default pixels to reduce response size
                [sequelize_1.Op.or]: [
                    { color: { [sequelize_1.Op.ne]: '#FFFFFF' } },
                    { url: { [sequelize_1.Op.ne]: '' } },
                    { owner: { [sequelize_1.Op.ne]: '' } }
                ]
            },
            limit: 10000 // Adjust the limit as needed
        });
        res.json({ pixels });
    }
    catch (error) {
        console.error('Error getting grid:', error);
        res.status(500).json({ error: 'Failed to retrieve grid' });
    }
});
// Get a single pixel
app.get('/api/pixel/:x/:y', async (req, res) => {
    try {
        const { x, y } = req.params;
        const xNum = parseInt(x);
        const yNum = parseInt(y);
        // Validate coordinates
        if (xNum < 0 || xNum >= WIDTH || yNum < 0 || yNum >= HEIGHT || isNaN(xNum) || isNaN(yNum)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }
        const pixel = await models_1.Pixel.findOne({
            where: { x: xNum, y: yNum },
            attributes: ['x', 'y', 'color', 'url', 'owner']
        });
        if (!pixel) {
            // If the pixel doesn't exist in the database, return default values
            return res.json({
                x: xNum,
                y: yNum,
                color: '#FFFFFF',
                url: '',
                owner: ''
            });
        }
        res.json(pixel);
    }
    catch (error) {
        console.error('Error getting pixel:', error);
        res.status(500).json({ error: 'Failed to retrieve pixel' });
    }
});
// Get pixels by owner
app.get('/api/pixels/owner/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const pixels = await models_1.Pixel.findAll({
            where: { owner: address },
            attributes: ['x', 'y', 'color', 'url', 'owner']
        });
        res.json({ pixels });
    }
    catch (error) {
        console.error('Error getting pixels by owner:', error);
        res.status(500).json({ error: 'Failed to retrieve pixels by owner' });
    }
});
// Start the server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();
        // Try to get the last processed version from database
        try {
            await models_1.sequelize.query('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT)');
            const [rows] = await models_1.sequelize.query('SELECT value FROM app_state WHERE key = \'lastProcessedVersion\'');
            // @ts-ignore
            const lastVersionStr = rows.length > 0 ? rows[0].value : '0';
            const lastVersion = BigInt(lastVersionStr);
            // Start listening for events
            startEventListener(lastVersion);
        }
        catch (error) {
            console.error('Error retrieving last processed version:', error);
            startEventListener(BigInt(0));
        }
        // Optionally backfill historical data (uncomment if needed on first run)
        // await backfillHistoricalData();
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
