# Aptos PixelBoard Client

This folder contains TypeScript utilities for interacting with the PixelBoard smart contract on Aptos blockchain.

## Setup

First, install the required dependencies:

```bash
yarn add aptos
# or
npm install aptos
```

## Environment Variables

You should set these environment variables in your `.env` file:

```
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com
NEXT_PUBLIC_APTOS_FAUCET_URL=https://faucet.devnet.aptoslabs.com
NEXT_PUBLIC_CONTRACT_ADDRESS=0xpixel_board_admin  # Replace with your actual deployed contract address
```

## Usage

The client provides functions to interact with all public methods of the PixelBoard smart contract:

1. `initBoard` - Initialize the board (admin only, one-time)
2. `buyPixels` - Buy new pixels on the board
3. `updatePixels` - Update pixels that you already own
4. `viewPixel` - View a pixel's data

### Basic Example

```typescript
import { PixelBoardClient, AptosUtils } from '../blockchain';

// Setup client
const nodeUrl = process.env.NEXT_PUBLIC_APTOS_NODE_URL;
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const client = new PixelBoardClient(nodeUrl, contractAddress);

// View a pixel
const pixelIndex = client.xyToIndex(5, 10); // Convert x,y coordinates to linear index
const pixelData = await client.viewPixel(pixelIndex);
console.log(pixelData);

// Buy pixels (requires account)
// In a real app, you'd get the account from the wallet connection
const account = AptosUtils.accountFromPrivateKey('YOUR_PRIVATE_KEY');

// Prepare data for 3 pixels
const indexes = [
  client.xyToIndex(5, 10),
  client.xyToIndex(6, 10),
  client.xyToIndex(7, 10)
];
const colors = [
  PixelBoardClient.rgbToArgb(255, 0, 0),  // Red
  PixelBoardClient.rgbToArgb(0, 255, 0),  // Green
  PixelBoardClient.rgbToArgb(0, 0, 255)   // Blue
];
const links = [
  PixelBoardClient.stringToUint8Array('https://example.com/1'),
  PixelBoardClient.stringToUint8Array('https://example.com/2'),
  PixelBoardClient.stringToUint8Array('https://example.com/3')
];

// Submit transaction
const txHash = await client.buyPixels(account, indexes, colors, links);
console.log(`Transaction hash: ${txHash}`);
```

See `examples.ts` for more detailed examples of how to use each function.

## Wallet Integration

This client doesn't handle wallet connection directly. In a real application, you would:

1. Integrate with a wallet library like Petra or Martian Wallet
2. Get the user's account from the wallet connection
3. Use that account to sign transactions

## Price Information

Based on the smart contract, each pixel costs 0.01 APT (1,000,000 octas). Make sure users have sufficient funds before attempting to buy pixels. 