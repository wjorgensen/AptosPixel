import { AptosClient, AptosAccount, FaucetClient, TokenClient, CoinClient, HexString, Types } from 'aptos';

export class PixelBoardClient {
  private client: AptosClient;
  private coinClient: CoinClient;
  private contractAddress: string = '0xpixel_board_admin'; // Replace with actual deployed address
  private moduleName: string = 'PixelBoard';

  constructor(nodeUrl: string, contractAddress?: string) {
    this.client = new AptosClient(nodeUrl);
    this.coinClient = new CoinClient(this.client);
    
    if (contractAddress) {
      this.contractAddress = contractAddress;
    }
  }

  /**
   * Convert an x,y coordinate to a linear index
   * @param x X coordinate (0-999)
   * @param y Y coordinate (0-999)
   * @returns Linear index
   */
  public xyToIndex(x: number, y: number): number {
    // Board dimensions from contract: 1000 x 1000
    const WIDTH = 1000;
    
    if (x < 0 || x >= WIDTH || y < 0 || y >= WIDTH) {
      throw new Error(`Coordinates (${x},${y}) out of bounds. Must be between (0,0) and (999,999)`);
    }
    
    return y * WIDTH + x;
  }

  /**
   * Initialize the board (can only be called once by the contract owner)
   * @param admin Admin account that will initialize the board
   * @returns Transaction hash
   */
  public async initBoard(admin: AptosAccount): Promise<string> {
    const payload: Types.TransactionPayload = {
      type: "entry_function_payload",
      function: `${this.contractAddress}::${this.moduleName}::init`,
      type_arguments: [],
      arguments: []
    };

    const txnRequest = await this.client.generateTransaction(admin.address(), payload);
    const signedTxn = await this.client.signTransaction(admin, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);
    
    return txnResult.hash;
  }

  /**
   * Buy new pixels on the board
   * @param account Account that is purchasing pixels
   * @param indexes Array of pixel indexes to purchase
   * @param argbs Array of ARGB color values (0xAARRGGBB format)
   * @param links Array of links (byte strings, max 64 bytes each)
   * @returns Transaction hash
   */
  public async buyPixels(
    account: any,
    indexes: number[],
    argbs: number[],
    links: Uint8Array[]
  ): Promise<string> {
    if (indexes.length !== argbs.length || indexes.length !== links.length) {
      throw new Error("Arrays must have the same length");
    }
    
    // Convert links to their byte representation
    const serializedLinks = links.map(link => Array.from(link));
    
    const payload = {
      type: "entry_function_payload",
      function: `${this.contractAddress}::${this.moduleName}::buy_pixels`,
      type_arguments: [],
      arguments: [indexes, argbs, serializedLinks]
    };

    // Use the new method if account is not AptosAccount
    if (!('signingKey' in account)) {
      return this.executeTransactionWithWallet(account, payload);
    }

    // Original implementation for AptosAccount
    const txnRequest = await this.client.generateTransaction(account.address, payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);
    
    return txnResult.hash;
  }

  /**
   * Update pixels that you already own
   * @param account Account that owns the pixels
   * @param indexes Array of pixel indexes to update
   * @param argbs Array of new ARGB color values
   * @param links Array of new links
   * @returns Transaction hash
   */
  public async updatePixels(
    account: any,
    indexes: number[],
    argbs: number[],
    links: Uint8Array[]
  ): Promise<string> {
    if (indexes.length !== argbs.length || indexes.length !== links.length) {
      throw new Error("Arrays must have the same length");
    }
    
    // Convert links to their byte representation
    const serializedLinks = links.map(link => Array.from(link));
    
    const payload = {
      type: "entry_function_payload",
      function: `${this.contractAddress}::${this.moduleName}::update_pixels`,
      type_arguments: [],
      arguments: [indexes, argbs, serializedLinks]
    };

    // Use the new method if account is not AptosAccount
    if (!('signingKey' in account)) {
      return this.executeTransactionWithWallet(account, payload);
    }

    // Original implementation for AptosAccount
    const txnRequest = await this.client.generateTransaction(account.address, payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);
    
    return txnResult.hash;
  }

  /**
   * View a pixel's data
   * @param index Linear index of the pixel to view
   * @returns Pixel data (owner, color, link)
   */
  public async viewPixel(index: number): Promise<{
    owner: string;
    argb: number;
    link: Uint8Array;
  }> {
    const payload: Types.ViewRequest = {
      function: `${this.contractAddress}::${this.moduleName}::view_pixel`,
      type_arguments: [],
      arguments: [index]
    };

    try {
      const response = await this.client.view(payload);
      if (Array.isArray(response) && response.length >= 3) {
        // Parse the response based on the Pixel struct
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
  }

  /**
   * Helper function to convert a string to Uint8Array
   * @param str String to convert
   * @returns Uint8Array representation
   */
  public static stringToUint8Array(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  /**
   * Helper function to convert Uint8Array to string
   * @param bytes Uint8Array to convert
   * @returns String representation
   */
  public static uint8ArrayToString(bytes: Uint8Array): string {
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  /**
   * Helper function to convert an RGB color to ARGB format
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @param a Alpha component (0-255), defaults to 255 (fully opaque)
   * @returns ARGB value as a number
   */
  public static rgbToArgb(r: number, g: number, b: number, a: number = 255): number {
    return ((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
  }

  public async executeTransactionWithWallet(
    account: any,
    payload: any
  ): Promise<string> {
    const pendingTransaction = await (window as any).aptos.signAndSubmitTransaction(payload);
    await this.client.waitForTransaction(pendingTransaction.hash);
    return pendingTransaction.hash;
  }
} 