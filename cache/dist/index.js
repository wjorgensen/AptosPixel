"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const redis_1 = require("redis");
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const aptos_1 = require("aptos");
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
// Redis client setup
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://redis:6379'
});
// Redis error handling
redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});
// Connect to Redis
async function connectRedis() {
    await redisClient.connect();
    console.log('Connected to Redis');
}
// Initialize the grid with default values if it doesn't exist
async function initializeGrid() {
    const exists = await redisClient.exists('pixelGrid');
    if (!exists) {
        console.log('Initializing pixel grid...');
        // Create a pipeline for faster bulk operations
        const pipeline = redisClient.multi();
        // Default pixel values
        const defaultPixel = {
            color: '#FFFFFF',
            url: '',
            owner: ''
        };
        // Set each pixel in the grid to the default value
        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                const key = `pixel:${x}:${y}`;
                pipeline.hSet(key, 'color', defaultPixel.color);
                pipeline.hSet(key, 'url', defaultPixel.url);
                pipeline.hSet(key, 'owner', defaultPixel.owner);
            }
        }
        await pipeline.exec();
        console.log('Pixel grid initialized with default values');
    }
}
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
// Function to handle pixel bought events
async function handlePixelBought(event) {
    try {
        const { id, owner, argb, link } = event;
        const coords = convertToXY(parseInt(id));
        const { x, y } = coords;
        const hexColor = argbToHex(argb);
        const url = decodeLink(link);
        const key = `pixel:${x}:${y}`;
        await redisClient.hSet(key, {
            color: hexColor,
            url: url,
            owner: owner
        });
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
        const key = `pixel:${x}:${y}`;
        await redisClient.hSet(key, {
            color: hexColor,
            url: url,
            owner: owner
        });
        console.log(`Pixel updated at (${x}, ${y}) by ${owner}`);
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
                // Store the current version in Redis for restart recovery
                await redisClient.set('lastProcessedVersion', currentVersion.toString());
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
        // Check Redis connection
        const pong = await redisClient.ping();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            redis: pong === 'PONG' ? 'connected' : 'error',
            version: process.env.npm_package_version || '1.0.0'
        });
    }
    catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            redis: 'error'
        });
    }
});
// Get the entire grid
app.get('/api/grid', async (req, res) => {
    try {
        const grid = [];
        // Get all pixels and their data
        for (let x = 0; x < WIDTH; x++) {
            const row = [];
            for (let y = 0; y < HEIGHT; y++) {
                const key = `pixel:${x}:${y}`;
                const rawPixel = await redisClient.hGetAll(key);
                // Convert raw Redis data to RedisPixel with defaults
                const pixel = {
                    color: rawPixel.color || '#FFFFFF',
                    url: rawPixel.url || '',
                    owner: rawPixel.owner || ''
                };
                row.push({
                    x,
                    y,
                    color: pixel.color,
                    url: pixel.url,
                    owner: pixel.owner
                });
            }
            grid.push(row);
        }
        res.json({ grid });
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
        const key = `pixel:${xNum}:${yNum}`;
        const rawPixel = await redisClient.hGetAll(key);
        // Convert raw Redis data to RedisPixel with defaults
        const pixel = {
            color: rawPixel.color || '#FFFFFF',
            url: rawPixel.url || '',
            owner: rawPixel.owner || ''
        };
        res.json({
            x: xNum,
            y: yNum,
            color: pixel.color,
            url: pixel.url,
            owner: pixel.owner
        });
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
        const pixels = [];
        // Instead of using a pipeline which has typing issues, let's use individual queries
        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                const key = `pixel:${x}:${y}`;
                const rawPixel = await redisClient.hGetAll(key);
                if (rawPixel && rawPixel.owner === address) {
                    pixels.push({
                        x,
                        y,
                        color: rawPixel.color || '#FFFFFF',
                        url: rawPixel.url || '',
                        owner: rawPixel.owner
                    });
                }
            }
        }
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
        await connectRedis();
        await initializeGrid();
        // Try to get the last processed version from Redis
        const lastVersionStr = await redisClient.get('lastProcessedVersion');
        const lastVersion = lastVersionStr ? BigInt(lastVersionStr) : BigInt(0);
        // Start listening for events
        startEventListener(lastVersion);
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
