# Pixel Grid Cache

A dockerized PostgreSQL database system for a 1000x1000 grid of pixels with the following properties for each cell:
- X,Y coordinates
- Color (hex code)
- URL (limited to 64 bytes)
- Owner (Aptos blockchain address)

## Tech Stack
- TypeScript
- Express.js
- PostgreSQL
- Sequelize ORM
- Docker
- Aptos SDK

## Setup

### Requirements
- Docker and Docker Compose

### Installation

1. Clone this repository
2. Configure your `.env` file:
```
PORT=3005
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=pixels
APTOS_CONTRACT_ADDRESS=<your-contract-address>
APTOS_NETWORK=mainnet
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
```
3. Run the application with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- The API service on port 3005
- PostgreSQL database on port 5432

## How It Works

This service stores pixel data from the Aptos blockchain PixelBoard contract. It:
1. Maintains a local PostgreSQL database of the entire pixel board
2. Listens for blockchain events (PixelBoughtEvent and PixelUpdatedEvent)
3. Automatically updates the database when pixels are bought or updated
4. Provides fast API access to the current state of the pixel board

### Event Listening

The system listens to two types of events from the Aptos smart contract:
- `PixelBoughtEvent`: Triggered when a new pixel is purchased
- `PixelUpdatedEvent`: Triggered when an existing pixel is updated

When these events occur, the database is automatically updated without requiring any API calls.

## API Endpoints

### Health Check
```http
GET /health
```

Checks the health and status of the API and database connection.

**Response Example:**
```json
{
  "status": "ok",
  "timestamp": "2023-07-21T15:30:45.123Z",
  "database": "connected",
  "version": "1.0.0"
}
```

### Get the entire grid
```http
GET /api/grid
```

Returns a list of non-default pixels in the grid (pixels that have been purchased or modified). Default pixels (white color, no URL, no owner) are excluded to reduce response size.

**Response Example:**
```json
{
  "pixels": [
    {
      "x": 5,
      "y": 10,
      "color": "#FF5733",
      "url": "https://example.com",
      "owner": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
    },
    {
      "x": 6,
      "y": 10,
      "color": "#3366FF",
      "url": "https://anothersite.com",
      "owner": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
    }
    // ... more pixels
  ]
}
```

### Get a single pixel
```http
GET /api/pixel/:x/:y
```

Returns data for a single pixel at coordinates (x,y). Coordinates must be within the valid range (0-999).

**Parameters:**
- `x` - X-coordinate (0-999)
- `y` - Y-coordinate (0-999)

**Response Example:**
```json
{
  "x": 5,
  "y": 10,
  "color": "#FF5733",
  "url": "https://example.com",
  "owner": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

**Error Response - Invalid Coordinates:**
```json
{
  "error": "Invalid coordinates"
}
```

### Get pixels by owner
```http
GET /api/pixels/owner/:address
```

Returns all pixels owned by the specified Aptos address.

**Parameters:**
- `address` - The Aptos blockchain address of the pixel owner

**Response Example:**
```json
{
  "pixels": [
    {
      "x": 5,
      "y": 10,
      "color": "#FF5733",
      "url": "https://example.com",
      "owner": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
    },
    {
      "x": 6,
      "y": 10,
      "color": "#3366FF",
      "url": "https://anothersite.com",
      "owner": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
    }
    // ... more pixels owned by this address
  ]
}
```

## Data Structure

Each pixel is stored in PostgreSQL with the following structure:

- `id`: Auto-incrementing primary key
- `x`: X coordinate (0-999)
- `y`: Y coordinate (0-999)
- `color`: Hex color code (e.g., `#FF5733`)
- `url`: URL string (limited to 64 bytes in the original contract)
- `owner`: Aptos address of the pixel owner

## Updates and Event Listening

The cache is automatically updated by listening to Aptos blockchain events. There are no endpoints to directly modify pixels through the API, as all updates come from the blockchain.

The system listens to two types of events:
- `PixelBoughtEvent`: Triggered when a new pixel is purchased
- `PixelUpdatedEvent`: Triggered when an existing pixel is updated

These events are processed and synchronized with the database in near real-time.

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Run in development mode with auto-reload
npm run dev

# Build TypeScript files
npm run build

# Run production build
npm start
```

### Docker Development

To make changes to the application:

1. Modify the code
2. Rebuild and restart the containers:

```bash
docker-compose down
docker-compose up -d --build
```

## Deployment

This service is designed to be deployed on Railway or similar container hosting platforms. 

## Smart Contract Integration

This cache connects to the following Aptos smart contract:

```move
module pixel_board_admin::PixelBoard {
    // ...contract code...
}
```

The system listens for the following events:
- `PixelBoughtEvent`: When a pixel is purchased
- `PixelUpdatedEvent`: When a pixel is updated

All updates to the database come directly from the blockchain, ensuring data consistency. 