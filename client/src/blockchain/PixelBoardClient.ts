import { AptosClient, AptosAccount, FaucetClient, TokenClient, CoinClient, HexString, Types } from 'aptos';

export class AptosUtils {
  /**
   * Create an AptosAccount from a private key
   * @param privateKeyHex Private key in hex format
   * @returns AptosAccount instance
   */
  public static accountFromPrivateKey(privateKeyHex: string): AptosAccount {
    const privateKey = HexString.ensure(privateKeyHex).toUint8Array();
    return new AptosAccount(privateKey);
  }

  /**
   * Create a new random AptosAccount
   * @returns A new randomly generated AptosAccount
   */
  public static createNewAccount(): AptosAccount {
    return new AptosAccount();
  }

  /**
   * Request tokens from the faucet (for testnet/devnet only)
   * @param faucetUrl Faucet URL (e.g., "https://faucet.devnet.aptoslabs.com")
   * @param account Account to fund
   * @param amount Amount of tokens to fund (default: 100000000)
   */
  public static async fundAccount(
    faucetUrl: string,
    nodeUrl: string,
    account: AptosAccount,
    amount: number = 100000000
  ): Promise<void> {
    const faucetClient = new FaucetClient(nodeUrl, faucetUrl);
    await faucetClient.fundAccount(account.address(), amount);
  }

  /**
   * Get account balance
   * @param nodeUrl Node URL
   * @param address Account address
   * @returns Balance in Octas (smallest unit)
   */
  public static async getBalance(nodeUrl: string, address: string): Promise<bigint> {
    const client = new AptosClient(nodeUrl);
    const coinClient = new CoinClient(client);
    return await coinClient.checkBalance(address);
  }

  /**
   * Utility to convert an Aptos address to the canonical format
   * @param address Address in any format
   * @returns Canonical address format
   */
  public static normalizeAddress(address: string): string {
    return HexString.ensure(address).toString();
  }
}

export class PixelBoardClient {
  private client: AptosClient;
  private contractAddress: string;
  
  constructor(nodeUrl: string, contractAddress: string) {
    this.client = new AptosClient(nodeUrl);
    this.contractAddress = contractAddress;
  }
  
  public xyToIndex(x: number, y: number): number {
    return y * 100 + x;
  }
  
  public static rgbToArgb(r: number, g: number, b: number): number {
    return (255 << 24) | (r << 16) | (g << 8) | b;
  }
  
  public static stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }
  
  public static uint8ArrayToString(arr: Uint8Array): string {
    return new TextDecoder().decode(arr);
  }
  
  public async initBoard(adminAccount: AptosAccount): Promise<string> {
    const payload: Types.TransactionPayload = {
      type: "entry_function_payload",
      function: `${this.contractAddress}::pixel_board::init_board`,
      type_arguments: [],
      arguments: []
    };
    
    const txnRequest = await this.client.generateTransaction(adminAccount.address(), payload);
    const signedTxn = await this.client.signTransaction(adminAccount, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);
    
    return txnResult.hash;
  }
  
  public async buyPixels(account: AptosAccount | any, indexes: number[], colors: number[], links: Uint8Array[]): Promise<string> {
    // Convert links to strings for transaction
    const linkStrings = links.map(link => Array.from(link));
    
    const payload: Types.TransactionPayload = {
      type: "entry_function_payload",
      function: `${this.contractAddress}::pixel_board::buy_pixels`,
      type_arguments: [],
      arguments: [indexes, colors, linkStrings]
    };
    
    // If account is from wallet adapter
    if ('signAndSubmitTransaction' in account) {
      const response = await account.signAndSubmitTransaction({
        type: "entry_function_payload",
        function: `${this.contractAddress}::pixel_board::buy_pixels`,
        arguments: [indexes, colors, linkStrings],
        type_arguments: []
      });
      
      return response.hash;
    } 
    else {
      const txnRequest = await this.client.generateTransaction(account.address(), payload);
      const signedTxn = await this.client.signTransaction(account, txnRequest);
      const txnResult = await this.client.submitTransaction(signedTxn);
      await this.client.waitForTransaction(txnResult.hash);
      
      return txnResult.hash;
    }
  }
  
  public async updatePixels(account: AptosAccount | any, indexes: number[], colors: number[], links: Uint8Array[]): Promise<string> {
    // Convert links to strings for transaction
    const linkStrings = links.map(link => Array.from(link));
    
    const payload: Types.TransactionPayload = {
      type: "entry_function_payload",
      function: `${this.contractAddress}::pixel_board::update_pixels`,
      type_arguments: [],
      arguments: [indexes, colors, linkStrings]
    };
    
    if ('signAndSubmitTransaction' in account) {
      const response = await account.signAndSubmitTransaction({
        type: "entry_function_payload",
        function: `${this.contractAddress}::pixel_board::update_pixels`,
        arguments: [indexes, colors, linkStrings],
        type_arguments: []
      });
      
      return response.hash;
    } 
    // If account is AptosAccount
    else {
      const txnRequest = await this.client.generateTransaction(account.address(), payload);
      const signedTxn = await this.client.signTransaction(account, txnRequest);
      const txnResult = await this.client.submitTransaction(signedTxn);
      await this.client.waitForTransaction(txnResult.hash);
      
      return txnResult.hash;
    }
  }
  
  public async viewPixel(index: number): Promise<{owner: string, argb: number, link: Uint8Array}> {
    try {
      const resource = await this.client.getAccountResource(
        this.contractAddress,
        `${this.contractAddress}::pixel_board::PixelBoard`
      );
      
      // @ts-ignore - Access the pixels field from the resource data
      const pixels = resource.data.pixels;
      const pixel = pixels[index];
      
      if (pixel) {
        return {
          owner: pixel.owner,
          argb: parseInt(pixel.argb),
          link: new Uint8Array(pixel.link)
        };
      }
      
      return {
        owner: "0x0",
        argb: 0x00000000,
        link: new Uint8Array()
      };
    } catch (error) {
      console.error("Error viewing pixel:", error);
      
      return {
        owner: "0x0",
        argb: 0x00000000,
        link: new Uint8Array()
      };
    }
  }
} 