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
  const { connected, account } = useWallet();
  
  const gridSize = 20;
  const gridColor = '#2a2a2a';
  const gridHighlightColor = '#3a3a3a';
  const BOARD_WIDTH = 1000;
  
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
  
  const placePixel = async (x: number, y: number, argb: number) => {
    if (!pixelBoardClient || !connected || !account) return;
    
    try {
      const index = pixelBoardClient.xyToIndex(x, y);
      const pixel = pixelData.get(index);
      
      const link = PixelBoardClient.stringToUint8Array("");
      
      if (pixel && pixel.owner === account.address.toString()) {
        await pixelBoardClient.updatePixels(
          account,
          [index],
          [argb],
          [link]
        );
      } else {
        await pixelBoardClient.buyPixels(
          account,
          [index],
          [argb],
          [link]
        );
      }
      
      await fetchPixelData(x, y);
    } catch (error) {
      console.error(`Error placing pixel at (${x},${y}):`, error);
    }
  };
  
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#1a1a1a';
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
    
    if (isLoading) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '12px sans-serif';
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
        setSelectedPixel(gridCoords);
        
        if (e.detail === 2 && connected) {
          placePixel(gridCoords.x, gridCoords.y, selectedColor);
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
        </div>
      )}
    </div>
  );
};

export default PixelCanvas;