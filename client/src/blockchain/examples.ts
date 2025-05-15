import { PixelBoardClient, AptosUtils } from './index';
import { AptosAccount } from 'aptos';

// Example configuration
const NODE_URL = process.env.NEXT_PUBLIC_APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com';
const FAUCET_URL = process.env.NEXT_PUBLIC_APTOS_FAUCET_URL || 'https://faucet.devnet.aptoslabs.com';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xpixel_board_admin'; // Replace with actual deployed address

// Example 1: Initialize the board (admin only)
async function initializeBoard() {
  try {
    // This would typically be your admin private key from secure storage
    const adminPrivateKey = 'YOUR_ADMIN_PRIVATE_KEY_HERE';
    const adminAccount = AptosUtils.accountFromPrivateKey(adminPrivateKey);
    
    const client = new PixelBoardClient(NODE_URL, CONTRACT_ADDRESS);
    const txHash = await client.initBoard(adminAccount);
    
    console.log(`Board initialized. Transaction hash: ${txHash}`);
  } catch (error) {
    console.error('Error initializing board:', error);
  }
}

// Example 2: Buy pixels
async function buyPixelsExample() {
  try {
    // Get user account (in a real app, this would come from wallet connection)
    const userPrivateKey = 'YOUR_PRIVATE_KEY'; // This would come from the user's wallet
    const userAccount = AptosUtils.accountFromPrivateKey(userPrivateKey);
    
    // For testing, you can create a new account and fund it
    // const userAccount = AptosUtils.createNewAccount();
    // await AptosUtils.fundAccount(FAUCET_URL, NODE_URL, userAccount, 100000000);
    
    const client = new PixelBoardClient(NODE_URL, CONTRACT_ADDRESS);
    
    // Buy 3 pixels
    const indexes = [
      client.xyToIndex(5, 10),
      client.xyToIndex(6, 10),
      client.xyToIndex(7, 10)
    ];
    const colors = [
      PixelBoardClient.rgbToArgb(255, 0, 0),     // Red
      PixelBoardClient.rgbToArgb(0, 255, 0),     // Green
      PixelBoardClient.rgbToArgb(0, 0, 255)      // Blue
    ];
    const links = [
      PixelBoardClient.stringToUint8Array('https://example.com/1'),
      PixelBoardClient.stringToUint8Array('https://example.com/2'),
      PixelBoardClient.stringToUint8Array('https://example.com/3')
    ];
    
    const txHash = await client.buyPixels(userAccount, indexes, colors, links);
    console.log(`Pixels purchased. Transaction hash: ${txHash}`);
  } catch (error) {
    console.error('Error buying pixels:', error);
  }
}

// Example 3: Update pixels
async function updatePixelsExample() {
  try {
    // Get user account (in a real app, this would come from wallet connection)
    const userPrivateKey = 'YOUR_PRIVATE_KEY'; // This would come from the user's wallet
    const userAccount = AptosUtils.accountFromPrivateKey(userPrivateKey);
    
    const client = new PixelBoardClient(NODE_URL, CONTRACT_ADDRESS);
    
    // Update 2 pixels that the user already owns
    const indexes = [
      client.xyToIndex(5, 10),
      client.xyToIndex(6, 10)
    ];
    const newColors = [
      PixelBoardClient.rgbToArgb(128, 0, 128),   // Purple
      PixelBoardClient.rgbToArgb(255, 165, 0)    // Orange
    ];
    const newLinks = [
      PixelBoardClient.stringToUint8Array('https://example.com/updated1'),
      PixelBoardClient.stringToUint8Array('https://example.com/updated2')
    ];
    
    const txHash = await client.updatePixels(userAccount, indexes, newColors, newLinks);
    console.log(`Pixels updated. Transaction hash: ${txHash}`);
  } catch (error) {
    console.error('Error updating pixels:', error);
  }
}

// Example 4: View a pixel
async function viewPixelExample() {
  try {
    const client = new PixelBoardClient(NODE_URL, CONTRACT_ADDRESS);
    
    // View a pixel at coordinates (5, 10)
    const index = client.xyToIndex(5, 10);
    const pixel = await client.viewPixel(index);
    
    console.log('Pixel data:');
    console.log('  Owner:', pixel.owner);
    console.log('  Color (ARGB):', pixel.argb.toString(16)); // Convert to hex
    console.log('  Link:', PixelBoardClient.uint8ArrayToString(pixel.link));
  } catch (error) {
    console.error('Error viewing pixel:', error);
  }
}

// These examples would be called from your application as needed
// initializeBoard();       // Admin only, one-time initialization
// buyPixelsExample();      // For users to purchase pixels
// updatePixelsExample();   // For users to update their pixels
// viewPixelExample();      // For anyone to view pixel data 