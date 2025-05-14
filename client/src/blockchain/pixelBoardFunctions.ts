import { AptosClient, Types, HexString } from 'aptos';

// Constants from the contract
export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 1000;
export const PRICE_PER_PIXEL = 1_000_000; // in octas (0.01 APT)
export const MAX_LINK_LENGTH = 64; // bytes

// Contract info
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x3c796998bee4da8425806eac57b55c155c1c1de067b167bec5ad8ea45f5793f9';
// The module name is PixelBoard with exact capitalization
export const MODULE_NAME = 'PixelBoard';

// Types matching contract structs
export interface Pixel {
  owner: string;
  argb: number;
  link: Uint8Array;
}

export interface PixelWithId {
  id: number;
  pixel: Pixel;
}

// Type for wallet adapters
export type SignAndSubmitTransaction = (payload: any) => Promise<{ hash: string }>;

// Client setup
export const getClient = () => {
  // Get the node URL from environment or default to testnet
  const nodeUrl = process.env.NEXT_PUBLIC_APTOS_NODE_URL || 'https://fullnode.testnet.aptoslabs.com';
  console.log("Connecting to Aptos network:", nodeUrl);
  return new AptosClient(nodeUrl);
};

// Coordinate utilities
export const xyToIndex = (x: number, y: number): number => {
  if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
    throw new Error(`Coordinates (${x},${y}) out of bounds. Must be between (0,0) and (999,999)`);
  }
  return y * BOARD_WIDTH + x;
};

export const indexToXY = (index: number): [number, number] => {
  const x = index % BOARD_WIDTH;
  const y = Math.floor(index / BOARD_WIDTH);
  return [x, y];
};

// String/byte conversions
export const stringToUint8Array = (str: string): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(str);
};

export const uint8ArrayToString = (bytes: Uint8Array): string => {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
};

// Color conversions
export const rgbToArgb = (r: number, g: number, b: number, a: number = 255): number => {
  return ((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
};

// Contract interaction functions

/**
 * Initialize the board (admin only, one-time)
 * @param signAndSubmitTransaction Function from wallet to sign and submit 
 * @returns Transaction hash
 */
export const initBoard = async (
  signAndSubmitTransaction: SignAndSubmitTransaction
): Promise<string> => {
  const transaction = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::init`,
    type_arguments: [],
    arguments: []
  };

  const result = await signAndSubmitTransaction(transaction);
  return result.hash;
};

/**
 * Buy new pixels on the board
 * @param signAndSubmitTransaction Function from wallet to sign and submit
 * @param indexes Array of pixel indexes to purchase
 * @param argbs Array of ARGB color values
 * @param links Array of links
 * @returns Transaction hash
 */
export const buyPixels = async (
  signAndSubmitTransaction: SignAndSubmitTransaction,
  indexes: number[],
  argbs: number[],
  links: Uint8Array[]
): Promise<string> => {
  if (indexes.length !== argbs.length || indexes.length !== links.length) {
    throw new Error("Arrays must have the same length");
  }
  
  // Convert links to array format for Aptos
  const serializedLinks = links.map(link => Array.from(link));
  
  const transaction = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::buy_pixels`,
    type_arguments: [],
    arguments: [indexes, argbs, serializedLinks]
  };

  const result = await signAndSubmitTransaction(transaction);
  return result.hash;
};

/**
 * Update existing pixels that you own
 * @param signAndSubmitTransaction Function from wallet to sign and submit
 * @param indexes Array of pixel indexes to update
 * @param argbs Array of new ARGB color values
 * @param links Array of new links
 * @returns Transaction hash
 */
export const updatePixels = async (
  signAndSubmitTransaction: SignAndSubmitTransaction,
  indexes: number[],
  argbs: number[],
  links: Uint8Array[]
): Promise<string> => {
  if (indexes.length !== argbs.length || indexes.length !== links.length) {
    throw new Error("Arrays must have the same length");
  }
  
  // Convert links to array format for Aptos
  const serializedLinks = links.map(link => Array.from(link));
  
  const transaction = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::update_pixels`,
    type_arguments: [],
    arguments: [indexes, argbs, serializedLinks]
  };

  const result = await signAndSubmitTransaction(transaction);
  return result.hash;
};

/**
 * View a single pixel
 * @param index The index of the pixel to view
 * @returns Pixel data
 */
export const viewPixel = async (index: number): Promise<Pixel> => {
  const client = getClient();
  
  const payload: Types.ViewRequest = {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::view_pixel`,
    type_arguments: [],
    arguments: [index]
  };

  try {
    const response = await client.view(payload);
    
    if (Array.isArray(response) && response.length >= 3) {
      const [owner, argb, linkBytes] = response;
      
      return {
        owner: owner as string,
        argb: Number(argb),
        link: new Uint8Array(linkBytes as number[])
      };
    } else {
      throw new Error("Unexpected response format");
    }
  } catch (error) {
    console.error("Error viewing pixel:", error);
    throw error;
  }
};

/**
 * View the entire board
 * @returns Array of all purchased pixels with their IDs
 */
export const viewBoard = async (): Promise<PixelWithId[]> => {
  const client = getClient();
  
  const payload: Types.ViewRequest = {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::view_board`,
    type_arguments: [],
    arguments: []
  };

  try {
    const response = await client.view(payload);
    
    if (Array.isArray(response) && response.length > 0) {
      return (response as any[]).map(pixelWithId => {
        const { id, pixel } = pixelWithId;
        const { owner, argb, link } = pixel;
        
        return {
          id: Number(id),
          pixel: {
            owner: owner as string,
            argb: Number(argb),
            link: new Uint8Array(link as number[])
          }
        };
      });
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error viewing board:", error);
    throw error;
  }
};

/**
 * Check if a user owns a specific pixel
 * @param userAddress The user's address
 * @param index The pixel index
 */
export const userOwnsPixel = async (userAddress: string, index: number): Promise<boolean> => {
  try {
    const pixel = await viewPixel(index);
    return pixel.owner === userAddress;
  } catch (error) {
    console.error("Error checking pixel ownership:", error);
    return false;
  }
};

/**
 * Get estimated cost to buy pixels in APT (1 APT = 100,000,000 octas)
 * @param pixelCount Number of pixels
 * @returns Cost in APT
 */
export const getPixelCost = (pixelCount: number): number => {
  const octas = PRICE_PER_PIXEL * pixelCount;
  return octas / 100_000_000; // Convert octas to APT
};

// Pixel property accessors
export const getPixelOwner = (pixel: Pixel): string => pixel.owner;
export const getPixelColor = (pixel: Pixel): number => pixel.argb;
export const getPixelLink = (pixel: Pixel): Uint8Array => pixel.link;
export const getPixelId = (pixelWithId: PixelWithId): number => pixelWithId.id;
export const getPixel = (pixelWithId: PixelWithId): Pixel => pixelWithId.pixel; 