import React, { useRef, useEffect, useState } from 'react';
import styles from '@/styles/PixelCanvas.module.css';
import { PixelBoardClient } from '@/blockchain/PixelBoardClient';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

interface PixelCanvasProps {
  width?: number;
  height?: number;
  pixelBoardClient?: PixelBoardClient;
}

interface Pixel {
  owner: string;
  argb: number;
  link: Uint8Array;
}

const PixelCanvas: React.FC<PixelCanvasProps> = ({ 
  width = 800, 
  height = 600,
  pixelBoardClient
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [selectedPixel, setSelectedPixel] = useState<{x: number, y: number} | null>(null);
  const [pixelData, setPixelData] = useState<Map<number, Pixel>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0xFF0000FF);
  const [showPurchaseUI, setShowPurchaseUI] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const { connected, account } = useWallet();
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [showColorChangeUI, setShowColorChangeUI] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedPixels, setSelectedPixels] = useState<{x: number, y: number}[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  
  const gridSize = 20;
  const gridColor = '#2a2a2a';
  const gridHighlightColor = '#3a3a3a';
  const BOARD_WIDTH = 1000;
  const PIXEL_PRICE = 0.01;  
  
  const screenToGrid = (screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: -1, y: -1 };
    
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    const gridX = Math.floor((canvasX - position.x) / (gridSize * scale));
    const gridY = Math.floor((canvasY - position.y) / (gridSize * scale));
    
    if (gridX < 0 || gridX >= BOARD_WIDTH || gridY < 0 || gridY >= BOARD_WIDTH) {
      return { x: -1, y: -1 };
    }
    
    return { x: gridX, y: gridY };
  };
  
  const fetchPixelData = async (x: number, y: number) => {
    if (!pixelBoardClient) return null;
    
    try {
      const index = pixelBoardClient.xyToIndex(x, y);
      const pixel = await pixelBoardClient.viewPixel(index);
      
      setPixelData(prevData => {
        const newData = new Map(prevData);
        newData.set(index, pixel);
        return newData;
      });
      
      return pixel;
    } catch (error) {
      console.error(`Error fetching pixel at (${x},${y}):`, error);
      return null;
    }
  };
  
  const fetchVisiblePixels = async () => {
    if (!pixelBoardClient || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const startX = Math.max(0, Math.floor(-position.x / (gridSize * scale)));
      const startY = Math.max(0, Math.floor(-position.y / (gridSize * scale)));
      const endX = Math.min(BOARD_WIDTH - 1, Math.ceil((width - position.x) / (gridSize * scale)));
      const endY = Math.min(BOARD_WIDTH - 1, Math.ceil((height - position.y) / (gridSize * scale)));
      
      const MAX_PIXELS = 100;
      const pixelsToFetch = [];
      
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const index = pixelBoardClient.xyToIndex(x, y);
          if (!pixelData.has(index)) {
            pixelsToFetch.push({ x, y });
            if (pixelsToFetch.length >= MAX_PIXELS) break;
          }
        }
        if (pixelsToFetch.length >= MAX_PIXELS) break;
      }
      
      await Promise.all(pixelsToFetch.map(({ x, y }) => fetchPixelData(x, y)));
    } catch (error) {
      console.error("Error fetching visible pixels:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const buyPixel = async () => {
    if (!connected || !account || !pixelBoardClient) return;
    
    const pixelsToUpdate = isMultiSelectMode ? selectedPixels : (selectedPixel ? [selectedPixel] : []);
    if (pixelsToUpdate.length === 0) return;
    
    setIsPurchasing(true);
    
    try {
      if (isDemoMode) {
        // Demo mode: Skip blockchain transaction and update UI directly
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate transaction time
        
        // Update local pixel data with the selected color for all selected pixels
        for (const pixel of pixelsToUpdate) {
          const index = pixelBoardClient.xyToIndex(pixel.x, pixel.y);
          const newPixel = {
            owner: account.address,
            argb: selectedColor,
            link: new Uint8Array()
          };
          
          setPixelData(prevData => {
            const newData = new Map(prevData);
            newData.set(index, newPixel);
            return newData;
          });
        }
        
        // Close purchase UI and redraw
        setShowPurchaseUI(false);
        setSelectedPixel(null);
        setSelectedPixels([]);
        setIsMultiSelectMode(false);
        drawCanvas();
      } else {
        // Real blockchain transaction code
        const indexes = pixelsToUpdate.map(p => pixelBoardClient.xyToIndex(p.x, p.y));
        const colors = pixelsToUpdate.map(() => selectedColor);
        const links = pixelsToUpdate.map(() => new Uint8Array());
        
        await pixelBoardClient.buyPixels(account, indexes, colors, links);
        
        // Refresh pixel data
        await Promise.all(pixelsToUpdate.map(p => fetchPixelData(p.x, p.y)));
        setShowPurchaseUI(false);
        setSelectedPixel(null);
        setSelectedPixels([]);
        setIsMultiSelectMode(false);
      }
    } catch (error) {
      console.error("Error buying pixels:", error);
    } finally {
      setIsPurchasing(false);
    }
  };
  
  const updatePixelColor = async () => {
    if (!connected || !account || !selectedPixel || !pixelBoardClient) return;
    
    setIsUpdating(true);
    
    try {
      if (isDemoMode) {
        // Demo mode: Skip blockchain transaction and update UI directly
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate transaction time
        
        // Update local pixel data with the new color
        const index = pixelBoardClient.xyToIndex(selectedPixel.x, selectedPixel.y);
        const existingPixel = pixelData.get(index);
        
        if (existingPixel) {
          const updatedPixel = {
            ...existingPixel,
            argb: selectedColor
          };
          
          setPixelData(prevData => {
            const newData = new Map(prevData);
            newData.set(index, updatedPixel);
            return newData;
          });
        }
        
        // Close color change UI and redraw
        setShowColorChangeUI(false);
        setSelectedPixel(null);
        drawCanvas();
      } else {
        // Real blockchain transaction
        const index = pixelBoardClient.xyToIndex(selectedPixel.x, selectedPixel.y);
        await pixelBoardClient.updatePixels(
          account,
          [index],
          [selectedColor],
          [new Uint8Array()]
        );
        
        // Refresh pixel data
        await fetchPixelData(selectedPixel.x, selectedPixel.y);
        setShowColorChangeUI(false);
        setSelectedPixel(null);
      }
    } catch (error) {
      console.error("Error updating pixel color:", error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const toggleMultiSelectMode = () => {
    if (isMultiSelectMode) {
      // Exit multi-select mode
      setIsMultiSelectMode(false);
      setSelectedPixels([]);
    } else {
      // Enter multi-select mode
      setIsMultiSelectMode(true);
      setSelectedPixel(null);
      setShowPurchaseUI(false);
      setShowColorChangeUI(false);
    }
  };
  
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    const offsetX = position.x % (gridSize * scale);
    const offsetY = position.y % (gridSize * scale);
    
    ctx.lineWidth = 1;
    for (let x = offsetX; x < width; x += gridSize * scale) {
      ctx.strokeStyle = (Math.round((x - offsetX) / (gridSize * scale)) % 5 === 0) 
        ? gridHighlightColor 
        : gridColor;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = offsetY; y < height; y += gridSize * scale) {
      ctx.strokeStyle = (Math.round((y - offsetY) / (gridSize * scale)) % 5 === 0) 
        ? gridHighlightColor 
        : gridColor;
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    if (pixelBoardClient) {
      const startX = Math.max(0, Math.floor(-position.x / (gridSize * scale)));
      const startY = Math.max(0, Math.floor(-position.y / (gridSize * scale)));
      const endX = Math.min(BOARD_WIDTH - 1, Math.ceil((width - position.x) / (gridSize * scale)));
      const endY = Math.min(BOARD_WIDTH - 1, Math.ceil((height - position.y) / (gridSize * scale)));
      
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const index = pixelBoardClient.xyToIndex(x, y);
          const pixel = pixelData.get(index);
          
          if (pixel) {
            const pixelX = position.x + x * gridSize * scale;
            const pixelY = position.y + y * gridSize * scale;
            const alpha = (pixel.argb >> 24) & 0xFF;
            const red = (pixel.argb >> 16) & 0xFF;
            const green = (pixel.argb >> 8) & 0xFF;
            const blue = pixel.argb & 0xFF;
            
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
            ctx.fillRect(
              pixelX, 
              pixelY, 
              gridSize * scale, 
              gridSize * scale
            );
          }
        }
      }
    }
    
    if (selectedPixel) {
      const pixelX = position.x + selectedPixel.x * gridSize * scale;
      const pixelY = position.y + selectedPixel.y * gridSize * scale;
      
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        pixelX, 
        pixelY, 
        gridSize * scale, 
        gridSize * scale
      );
      
      if (connected) {
        const alpha = (selectedColor >> 24) & 0xFF;
        const red = (selectedColor >> 16) & 0xFF;
        const green = (selectedColor >> 8) & 0xFF;
        const blue = selectedColor & 0xFF;
        
        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255 * 0.5})`;
        ctx.fillRect(
          pixelX, 
          pixelY, 
          gridSize * scale, 
          gridSize * scale
        );
      }
    }
    
    // Draw selection highlights for multi-select mode
    if (isMultiSelectMode && selectedPixels.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      
      for (const pixel of selectedPixels) {
        const pixelX = position.x + pixel.x * gridSize * scale;
        const pixelY = position.y + pixel.y * gridSize * scale;
        
        ctx.strokeRect(
          pixelX + 1, 
          pixelY + 1, 
          gridSize * scale - 2, 
          gridSize * scale - 2
        );
      }
    }
    
    if (isLoading) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('Loading...', 10, height - 10);
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      setIsDragging(true);
      setStartDragPosition({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    } else if (e.button === 0) {
      const gridCoords = screenToGrid(e.clientX, e.clientY);
      
      if (gridCoords.x >= 0 && gridCoords.y >= 0) {
        if (isMultiSelectMode && connected) {
          // In multi-select mode, add to selection
          const index = pixelBoardClient?.xyToIndex(gridCoords.x, gridCoords.y) || 0;
          const pixel = pixelData.get(index);
          
          // Only allow selecting unowned pixels in multi-select mode
          if (!pixel || (pixel && account && pixel.owner !== account.address.toString())) {
            // Check if this pixel is already selected
            const alreadySelected = selectedPixels.some(p => p.x === gridCoords.x && p.y === gridCoords.y);
            
            if (alreadySelected) {
              // Remove from selection if already selected
              setSelectedPixels(prev => prev.filter(p => !(p.x === gridCoords.x && p.y === gridCoords.y)));
            } else {
              // Add to selection
              setSelectedPixels(prev => [...prev, gridCoords]);
            }
            
            // Update total price
            setTotalPrice((isMultiSelectMode ? selectedPixels.length : 1) * PIXEL_PRICE);
          }
        } else {
          // Single select mode
          setSelectedPixel(gridCoords);
          
          if (connected && account) {
            const index = pixelBoardClient?.xyToIndex(gridCoords.x, gridCoords.y) || 0;
            const pixel = pixelData.get(index);
            
            // Check if user owns the pixel
            if (pixel && pixel.owner === account.address.toString()) {
              // Show color change UI instead of purchase UI
              setShowColorChangeUI(true);
            } else {
              // If user doesn't own the pixel, show purchase UI
              setShowPurchaseUI(true);
              setTotalPrice(PIXEL_PRICE);
            }
          }
        }
      }
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startDragPosition.x,
        y: e.clientY - startDragPosition.y
      });
    }
  };
  
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      fetchVisiblePixels();
    }
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();    
    const delta = -e.deltaY * 0.01;
    const newScale = Math.max(0.1, Math.min(5, scale + delta));    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;    
    const newPosition = {
      x: mouseX - (mouseX - position.x) * (newScale / scale),
      y: mouseY - (mouseY - position.y) * (newScale / scale)
    };
    
    setScale(newScale);
    setPosition(newPosition);
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };
  
  useEffect(() => {
    if (pixelBoardClient) {
      fetchVisiblePixels();
    }
  }, [position, scale, pixelBoardClient]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = width;
    canvas.height = height;
    
    drawGrid(ctx);
    
    const animationFrame = requestAnimationFrame(() => {
      drawGrid(ctx);
    });
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [position, scale, width, height, pixelData, selectedPixel, selectedColor]);
  
  return (
    <div className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        className={styles.pixelCanvas}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      
      {connected && (
        <div className={styles.colorSelector}>
          <div className={styles.colorPreview} style={{
            backgroundColor: `rgba(
              ${(selectedColor >> 16) & 0xFF},
              ${(selectedColor >> 8) & 0xFF},
              ${selectedColor & 0xFF},
              ${((selectedColor >> 24) & 0xFF) / 255}
            )`
          }} />
          <div className={styles.colorButtons}>
            {[0xFF0000FF, 0xFF00FF00, 0xFF0000FF, 0xFFFFFF00, 0xFFFF00FF, 0xFF00FFFF, 0xFFFFFFFF, 0xFF000000].map(color => (
              <button
                key={color}
                className={`${styles.colorButton} ${selectedColor === color ? styles.selected : ''}`}
                style={{
                  backgroundColor: `rgba(
                    ${(color >> 16) & 0xFF},
                    ${(color >> 8) & 0xFF},
                    ${color & 0xFF},
                    ${((color >> 24) & 0xFF) / 255}
                  )`
                }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
          <div className={styles.multiSelectToggle}>
            <button 
              className={`${styles.multiSelectButton} ${isMultiSelectMode ? styles.active : ''}`}
              onClick={toggleMultiSelectMode}
            >
              {isMultiSelectMode ? 'Exit Multi-Select' : 'Multi-Select'}
            </button>
            {isMultiSelectMode && selectedPixels.length > 0 && (
              <div className={styles.selectionInfo}>
                <span>{selectedPixels.length} pixels selected</span>
                <span className={styles.totalPrice}>
                  Total: {(selectedPixels.length * PIXEL_PRICE).toFixed(2)} APT
                </span>
                <button 
                  className={styles.buySelectedButton}
                  onClick={() => setShowPurchaseUI(true)}
                >
                  Buy Selected
                </button>
              </div>
            )}
          </div>
          <div className={styles.instructions}>
            <p>Right-click + drag to move</p>
            <p>Scroll to zoom</p>
            <p>Click to select a pixel</p>
          </div>
        </div>
      )}
      
      {showPurchaseUI && connected && (
        <div className={styles.purchaseOverlay}>
          <div className={styles.purchaseModal}>
            <h3>{isMultiSelectMode ? 'Buy Multiple Pixels' : 'Buy Pixel'}</h3>
            
            {isMultiSelectMode ? (
              <div className={styles.multiplePixelsInfo}>
                <p>{selectedPixels.length} pixels selected</p>
                <div className={styles.pixelGrid}>
                  {/* Show a small grid of the selected pixels */}
                  {selectedPixels.slice(0, 9).map((pixel, index) => (
                    <div 
                      key={index} 
                      className={styles.miniPixel}
                      style={{ backgroundColor: `rgba(
                        ${(selectedColor >> 16) & 0xFF},
                        ${(selectedColor >> 8) & 0xFF},
                        ${selectedColor & 0xFF},
                        ${((selectedColor >> 24) & 0xFF) / 255}
                      )` }}
                    />
                  ))}
                  {selectedPixels.length > 9 && (
                    <div className={styles.morePixels}>+{selectedPixels.length - 9} more</div>
                  )}
                </div>
              </div>
            ) : (
              selectedPixel && (
                <>
                  <p>Position: ({selectedPixel.x}, {selectedPixel.y})</p>
                  <div className={styles.pixelPreview} style={{
                    backgroundColor: `rgba(
                      ${(selectedColor >> 16) & 0xFF},
                      ${(selectedColor >> 8) & 0xFF},
                      ${selectedColor & 0xFF},
                      ${((selectedColor >> 24) & 0xFF) / 255}
                    )`
                  }}></div>
                </>
              )
            )}
            
            <p className={styles.priceTag}>
              {isDemoMode ? 'Demo Mode: Free' : `Price: ${totalPrice.toFixed(2)} APT`}
            </p>
            
            <div className={styles.purchaseActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => {
                  setShowPurchaseUI(false);
                  if (isMultiSelectMode) {
                    // Don't clear selection when canceling in multi-select mode
                  } else {
                    setSelectedPixel(null);
                  }
                }}
                disabled={isPurchasing}
              >
                Cancel
              </button>
              <button 
                className={styles.buyButton}
                onClick={buyPixel}
                disabled={isPurchasing || (isMultiSelectMode && selectedPixels.length === 0)}
              >
                {isPurchasing ? 'Processing...' : 'Buy Pixel'}
              </button>
            </div>
            
            {/* Demo mode toggle */}
            <div className={styles.demoToggle}>
              <label>
                <input 
                  type="checkbox" 
                  checked={isDemoMode} 
                  onChange={() => setIsDemoMode(!isDemoMode)}
                />
                Demo Mode (Free)
              </label>
            </div>
          </div>
        </div>
      )}
      
      {showColorChangeUI && connected && selectedPixel && (
        <div className={styles.purchaseOverlay}>
          <div className={styles.purchaseModal}>
            <h3>Change Pixel Color</h3>
            <p>Position: ({selectedPixel.x}, {selectedPixel.y})</p>
            <div className={styles.pixelPreview} style={{
              backgroundColor: `rgba(
                ${(selectedColor >> 16) & 0xFF},
                ${(selectedColor >> 8) & 0xFF},
                ${selectedColor & 0xFF},
                ${((selectedColor >> 24) & 0xFF) / 255}
              )`
            }}></div>
            
            <div className={styles.colorPickerContainer}>
              <p>Select a new color:</p>
              <div className={styles.colorButtons}>
                {[0xFF0000FF, 0xFF00FF00, 0xFF0000FF, 0xFFFFFF00, 0xFFFF00FF, 0xFF00FFFF, 0xFFFFFFFF, 0xFF000000].map(color => (
                  <button
                    key={color}
                    className={`${styles.colorButton} ${selectedColor === color ? styles.selected : ''}`}
                    style={{
                      backgroundColor: `rgba(
                        ${(color >> 16) & 0xFF},
                        ${(color >> 8) & 0xFF},
                        ${color & 0xFF},
                        ${((color >> 24) & 0xFF) / 255}
                      )`
                    }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
            
            <div className={styles.purchaseActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => {
                  setShowColorChangeUI(false);
                }}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button 
                className={styles.buyButton}
                onClick={updatePixelColor}
                disabled={isUpdating}
              >
                {isUpdating ? 'Processing...' : 'Update Color'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PixelCanvas;