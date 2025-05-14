'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { 
  initBoard, 
  viewPixel, 
  viewBoard, 
  buyPixels, 
  updatePixels,
  xyToIndex,
  indexToXY,
  rgbToArgb,
  stringToUint8Array,
  uint8ArrayToString,
  getPixelCost,
  PRICE_PER_PIXEL,
  CONTRACT_ADDRESS,
  MODULE_NAME,
  getClient
} from '@/blockchain/pixelBoardFunctions';

export default function TestPage() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  // State for inputs
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [color, setColor] = useState('#FF0000');
  const [link, setLink] = useState('https://example.com');
  const [batchSize, setBatchSize] = useState(1);
  
  // State for results
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [pixelData, setPixelData] = useState<any>(null);
  const [boardPixels, setBoardPixels] = useState<any[]>([]);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [network, setNetwork] = useState<string>('Unknown');
  
  // Get index from x,y
  const index = xyToIndex(x, y);
  
  // Connect wallet message
  const walletMessage = connected 
    ? `Connected: ${account?.address.toString()}` 
    : 'Please connect your wallet to send transactions';
    
  // Calculate total price
  const totalPrice = getPixelCost(batchSize);
    
  // Generate multiple coordinates for batch testing
  const generateBatchIndexes = () => {
    const indexes: number[] = [];
    const startIndex = xyToIndex(x, y);
    
    for (let i = 0; i < batchSize; i++) {
      // Create a horizontal line of pixels starting from x,y
      const currentIndex = startIndex + i;
      // Make sure we don't exceed the board width
      if (currentIndex < xyToIndex(x + batchSize, y)) {
        indexes.push(currentIndex);
      }
    }
    
    return indexes;
  };
  
  // Check modules available at the contract address
  const checkAvailableModules = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const client = getClient();
      
      // Detect network
      try {
        const chainId = await client.getChainId();
        if (chainId === 1) {
          setNetwork('Mainnet');
        } else if (chainId === 2) {
          setNetwork('Testnet');
        } else if (chainId === 38) {
          setNetwork('Devnet');
        } else {
          setNetwork(`Chain ID: ${chainId}`);
        }
        console.log("Connected to network:", chainId);
      } catch (e) {
        console.error("Error getting chain ID:", e);
        setNetwork('Unknown');
      }
      
      // This gets account resources and modules
      const accountData = await client.getAccount(CONTRACT_ADDRESS);
      const accountModules = await client.getAccountModules(CONTRACT_ADDRESS);
      
      // Extract module names
      const moduleNames = accountModules.map(m => m.abi?.name || 'unknown');
      
      setAvailableModules(moduleNames);
      console.log("Available modules:", moduleNames);
      
      if (!moduleNames.includes(MODULE_NAME)) {
        setError(`Current module name "${MODULE_NAME}" not found at address ${CONTRACT_ADDRESS}. Available modules: ${moduleNames.join(', ')}`);
      }
    } catch (err: any) {
      console.error("Error checking modules:", err);
      setError(`Error checking modules: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run module check on load
  useEffect(() => {
    checkAvailableModules();
  }, []);
  
  // Handler functions
  const handleInitBoard = async () => {
    if (!connected || !signAndSubmitTransaction) {
      setError('Please connect your wallet');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setTxHash('');
    
    try {
      const hash = await initBoard(signAndSubmitTransaction);
      setTxHash(hash);
    } catch (err: any) {
      setError(`Error initializing board: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewPixel = async () => {
    setIsLoading(true);
    setError('');
    setPixelData(null);
    
    try {
      const pixel = await viewPixel(index);
      
      setPixelData({
        position: { x, y, index },
        owner: pixel.owner,
        color: '#' + pixel.argb.toString(16).padStart(8, '0'),
        link: uint8ArrayToString(pixel.link)
      });
    } catch (err: any) {
      setError(`Error viewing pixel: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewBoard = async () => {
    setIsLoading(true);
    setError('');
    setBoardPixels([]);
    
    try {
      const allPixels = await viewBoard();
      
      const processed = allPixels.map(item => {
        const [pixelX, pixelY] = indexToXY(item.id);
        return {
          id: item.id,
          position: { x: pixelX, y: pixelY },
          owner: item.pixel.owner,
          color: '#' + item.pixel.argb.toString(16).padStart(8, '0'),
          link: uint8ArrayToString(item.pixel.link)
        };
      });
      
      setBoardPixels(processed);
    } catch (err: any) {
      setError(`Error viewing board: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBuyPixels = async () => {
    if (!connected || !signAndSubmitTransaction) {
      setError('Please connect your wallet');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setTxHash('');
    
    try {
      // Convert hex color to ARGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const argb = rgbToArgb(r, g, b);
      
      const linkBytes = stringToUint8Array(link);
      
      // Handle batch buying
      const indexes = generateBatchIndexes();
      const argbs = Array(batchSize).fill(argb);
      const links = Array(batchSize).fill(linkBytes);
      
      const hash = await buyPixels(
        signAndSubmitTransaction,
        indexes,
        argbs,
        links
      );
      
      setTxHash(hash);
    } catch (err: any) {
      setError(`Error buying pixels: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdatePixels = async () => {
    if (!connected || !signAndSubmitTransaction) {
      setError('Please connect your wallet');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setTxHash('');
    
    try {
      // Convert hex color to ARGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const argb = rgbToArgb(r, g, b);
      
      const linkBytes = stringToUint8Array(link);
      
      // Handle batch updating
      const indexes = generateBatchIndexes();
      const argbs = Array(batchSize).fill(argb);
      const links = Array(batchSize).fill(linkBytes);
      
      const hash = await updatePixels(
        signAndSubmitTransaction,
        indexes,
        argbs,
        links
      );
      
      setTxHash(hash);
    } catch (err: any) {
      setError(`Error updating pixels: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PixelBoard Test Page</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <p className="font-bold">{walletMessage}</p>
        <p className="mt-2">Network: <span className="font-bold">{network}</span></p>
        <p className="mt-2">Contract Address: {CONTRACT_ADDRESS}</p>
        <p>Current Module Name: {MODULE_NAME}</p>
        <div className="mt-3">
          <button 
            onClick={() => {
              console.log("Forcing network refresh");
              // Clear any cached client
              localStorage.removeItem('aptos-network-cache');
              // Force refresh
              checkAvailableModules();
            }}
            className="bg-yellow-500 text-white px-3 py-1 rounded"
          >
            Force Network Refresh
          </button>
        </div>
        {availableModules.length > 0 && (
          <div className="mt-2">
            <p>Available modules at this address:</p>
            <ul className="list-disc pl-5">
              {availableModules.map(module => (
                <li key={module} className={module === MODULE_NAME ? "font-bold" : ""}>
                  {module}
                </li>
              ))}
            </ul>
            <button 
              onClick={checkAvailableModules}
              className="mt-2 bg-blue-500 text-white px-3 py-1 rounded"
            >
              Refresh Modules
            </button>
          </div>
        )}
      </div>
      
      {/* Input Form */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-bold mb-4">Pixel Parameters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-1">X Coordinate (0-999):</label>
            <input 
              type="number" 
              min="0" 
              max="999" 
              value={x} 
              onChange={(e) => setX(parseInt(e.target.value))} 
              className="border p-2 w-full"
            />
          </div>
          
          <div>
            <label className="block mb-1">Y Coordinate (0-999):</label>
            <input 
              type="number" 
              min="0" 
              max="999" 
              value={y} 
              onChange={(e) => setY(parseInt(e.target.value))} 
              className="border p-2 w-full"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block mb-1">Calculated Index: {index}</label>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-1">Color:</label>
            <div className="flex items-center">
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                className="h-10 w-10 mr-2"
              />
              <input 
                type="text" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                className="border p-2 flex-grow"
              />
            </div>
          </div>
          
          <div>
            <label className="block mb-1">Link URL:</label>
            <input 
              type="text" 
              value={link} 
              onChange={(e) => setLink(e.target.value)} 
              className="border p-2 w-full"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block mb-1">Batch Size (number of pixels):</label>
          <input 
            type="number" 
            min="1" 
            max="100" 
            value={batchSize} 
            onChange={(e) => setBatchSize(parseInt(e.target.value))} 
            className="border p-2 w-full"
          />
          <p className="text-sm text-gray-600 mt-1">
            Total cost: {totalPrice} APT ({batchSize} pixels × {PRICE_PER_PIXEL / 100_000_000} APT each)
          </p>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={handleViewPixel} 
            disabled={isLoading} 
            className="bg-blue-500 text-white p-2 rounded disabled:opacity-50"
          >
            View Pixel
          </button>
          
          <button 
            onClick={handleViewBoard} 
            disabled={isLoading} 
            className="bg-blue-500 text-white p-2 rounded disabled:opacity-50"
          >
            View All Pixels
          </button>
          
          <button 
            onClick={handleBuyPixels} 
            disabled={isLoading || !connected} 
            className="bg-green-500 text-white p-2 rounded disabled:opacity-50"
          >
            Buy Pixels ({batchSize})
          </button>
          
          <button 
            onClick={handleUpdatePixels} 
            disabled={isLoading || !connected} 
            className="bg-yellow-500 text-white p-2 rounded disabled:opacity-50"
          >
            Update Pixels ({batchSize})
          </button>
          
          <button 
            onClick={handleInitBoard} 
            disabled={isLoading || !connected} 
            className="bg-red-500 text-white p-2 rounded disabled:opacity-50"
          >
            Initialize Board (Admin Only)
          </button>
        </div>
      </div>
      
      {/* Status and Results */}
      {isLoading && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <p className="text-center">Loading...</p>
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 border rounded bg-red-50">
          <h3 className="text-lg font-bold mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}
      
      {txHash && (
        <div className="mb-6 p-4 border rounded bg-green-50">
          <h3 className="text-lg font-bold mb-2">Transaction Submitted</h3>
          <p className="break-all">Hash: {txHash}</p>
        </div>
      )}
      
      {/* Pixel Data */}
      {pixelData && (
        <div className="mb-6 p-4 border rounded">
          <h3 className="text-lg font-bold mb-2">Pixel Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p>Position: ({pixelData.position.x}, {pixelData.position.y})</p>
              <p>Index: {pixelData.position.index}</p>
              <p>Owner: {pixelData.owner}</p>
            </div>
            <div>
              <p>
                Color: 
                <span 
                  className="inline-block w-6 h-6 ml-2 align-middle" 
                  style={{ backgroundColor: pixelData.color }}
                ></span>
                {pixelData.color}
              </p>
              <p>
                Link: <a href={pixelData.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{pixelData.link}</a>
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Board Pixels */}
      {boardPixels.length > 0 && (
        <div className="mb-6 p-4 border rounded">
          <h3 className="text-lg font-bold mb-2">All Pixels ({boardPixels.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Position</th>
                  <th className="border p-2">Owner</th>
                  <th className="border p-2">Color</th>
                  <th className="border p-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {boardPixels.slice(0, 100).map((pixel, index) => (
                  <tr key={pixel.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="border p-2">({pixel.position.x}, {pixel.position.y})</td>
                    <td className="border p-2 break-all">{pixel.owner}</td>
                    <td className="border p-2">
                      <span 
                        className="inline-block w-4 h-4 mr-2 align-middle" 
                        style={{ backgroundColor: pixel.color }}
                      ></span>
                      {pixel.color}
                    </td>
                    <td className="border p-2">
                      <a href={pixel.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                        {pixel.link.length > 30 ? pixel.link.substring(0, 30) + '...' : pixel.link}
                      </a>
                    </td>
                  </tr>
                ))}
                {boardPixels.length > 100 && (
                  <tr>
                    <td colSpan={4} className="border p-2 text-center">
                      Showing 100 of {boardPixels.length} pixels
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}