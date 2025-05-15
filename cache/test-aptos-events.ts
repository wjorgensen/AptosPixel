/**
 * Aptos Events Test Script (TypeScript version)
 * 
 * This script helps test the event handling functionality by manually
 * simulating Aptos blockchain events. It's useful for development and testing.
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';
import { PixelBoughtEvent, PixelUpdatedEvent, PixelCoordinates } from './src/types';

dotenv.config();

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Mock events to simulate
const mockEvents = {
  buyEvents: [
    {
      id: '42',  // Will be converted to pixel at x=42, y=0
      owner: '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
      argb: '0xFFFF0000',  // Red
      link: '0x68747470733a2f2f6578616d706c652e636f6d2f726564'  // "https://example.com/red" in hex
    },
    {
      id: '1042',  // Will be converted to pixel at x=42, y=1
      owner: '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
      argb: '0xFF0000FF',  // Blue
      link: '0x68747470733a2f2f6578616d706c652e636f6d2f626c7565'  // "https://example.com/blue" in hex
    }
  ] as PixelBoughtEvent[],
  updateEvents: [
    {
      id: '42',  // Will update the pixel at x=42, y=0
      owner: '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
      argb: '0xFF00FF00',  // Green
      link: '0x68747470733a2f2f6578616d706c652e636f6d2f677265656e'  // "https://example.com/green" in hex
    }
  ] as PixelUpdatedEvent[]
};

// Utility function to convert from 1D contract coordinate to 2D grid coordinates
function convertToXY(id: number): PixelCoordinates {
  const WIDTH = 1000;
  return {
    x: id % WIDTH,
    y: Math.floor(id / WIDTH)
  };
}

// Utility function to convert argb hex value to CSS color
function argbToHex(argb: string): string {
  // Remove 0x prefix if it exists
  const cleanArgb = argb.startsWith('0x') ? argb.substring(2) : argb;
  
  // ARGB format is 0xAARRGGBB, but we want #RRGGBB for CSS
  const r = cleanArgb.substring(2, 4);
  const g = cleanArgb.substring(4, 6);
  const b = cleanArgb.substring(6, 8);
  
  return `#${r}${g}${b}`;
}

// Function to decode UTF-8 encoded bytes to a string
function decodeLink(bytes: string): string {
  try {
    // Remove 0x prefix and convert hex pairs to bytes
    const hexString = bytes.startsWith('0x') ? bytes.substring(2) : bytes;
    
    // Convert hex to bytes
    const byteArray = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    
    // Decode bytes to string
    return new TextDecoder().decode(byteArray);
  } catch (error) {
    console.error('Error decoding link:', error);
    return '';
  }
}

// Function to handle pixel bought events
async function handlePixelBought(event: PixelBoughtEvent): Promise<void> {
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
    console.log(`  Color: ${hexColor}`);
    console.log(`  URL: ${url}`);
  } catch (error) {
    console.error('Error handling pixel bought event:', error);
  }
}

// Function to handle pixel updated events
async function handlePixelUpdated(event: PixelUpdatedEvent): Promise<void> {
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
    console.log(`  Color: ${hexColor}`);
    console.log(`  URL: ${url}`);
  } catch (error) {
    console.error('Error handling pixel updated event:', error);
  }
}

// Main function to process events
async function processEvents(): Promise<void> {
  try {
    console.log('Connecting to Redis...');
    await redisClient.connect();
    console.log('Connected to Redis');
    
    console.log('\nProcessing buy events...');
    for (const event of mockEvents.buyEvents) {
      await handlePixelBought(event);
    }
    
    console.log('\nProcessing update events...');
    for (const event of mockEvents.updateEvents) {
      await handlePixelUpdated(event);
    }
    
    console.log('\nEvents processed successfully');
    
    // Verify the changes in Redis
    console.log('\nVerifying changes in Redis:');
    for (const event of [...mockEvents.buyEvents, ...mockEvents.updateEvents]) {
      const { id } = event;
      const { x, y } = convertToXY(parseInt(id));
      const key = `pixel:${x}:${y}`;
      const pixel = await redisClient.hGetAll(key);
      console.log(`Pixel at (${x}, ${y}):`);
      console.log('  Color:', pixel.color);
      console.log('  URL:', pixel.url);
      console.log('  Owner:', pixel.owner);
    }
    
  } catch (error) {
    console.error('Error processing events:', error);
  } finally {
    await redisClient.quit();
    console.log('\nRedis connection closed');
  }
}

// Run the event processor
processEvents();

/**
 * To run this TypeScript test script:
 * 1. Make sure Redis is running
 * 2. Run: npx ts-node test-aptos-events.ts
 * 
 * This will simulate processing Aptos events and update the Redis cache accordingly.
 * You can then use the test-api.sh script to verify the changes via the API.
 */ 