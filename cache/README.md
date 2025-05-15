# Pixel Grid Redis Cache

A dockerized Redis cache system for a 1000x1000 grid of pixels with the following properties for each cell:
- X,Y coordinates
- Color (hex code)
- URL (limited to 64 bytes)
- Owner (Aptos blockchain address)

## Tech Stack
- TypeScript
- Express.js
- Redis
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
REDIS_URL=redis://redis:6379
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
- Redis cache on port 6379

## How It Works

This service caches pixel data from the Aptos blockchain PixelBoard contract. It:
1. Maintains a local Redis cache of the entire pixel board
2. Listens for blockchain events (PixelBoughtEvent and PixelUpdatedEvent)
3. Automatically updates the cache when pixels are bought or updated
4. Provides fast API access to the current state of the pixel board

### Event Listening

The cache listens to two types of events from the Aptos smart contract:
- `PixelBoughtEvent`: Triggered when a new pixel is purchased
- `PixelUpdatedEvent`: Triggered when an existing pixel is updated

When these events occur, the cache is automatically updated without requiring any API calls.

## API Endpoints

### Health Check
```
GET /health
```
Returns the health status of the API and Redis connection.

### Get the entire grid
```
GET /api/grid
```
Returns the entire 1000x1000 grid with all pixel data.

### Get a single pixel
```
GET /api/pixel/:x/:y
```
Returns data for a single pixel at coordinates (x,y).

### Get pixels by owner
```
GET /api/pixels/owner/:address
```
Returns all pixels owned by the specified Aptos address.

## Data Structure

Each pixel is stored in Redis with the following structure:

- Key: `pixel:x:y` (e.g., `pixel:42:128`)
- Values:
  - `color`: Hex color code (e.g., `#FF5733`)
  - `url`: URL string (max 64 bytes)
  - `owner`: Aptos address of the pixel owner

## Development

### Local Development

```bash
# Install dependencies
npm install

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

The cache listens for the following events:
- `PixelBoughtEvent`: When a pixel is purchased
- `PixelUpdatedEvent`: When a pixel is updated

All updates to the cache come directly from the blockchain, ensuring data consistency. 