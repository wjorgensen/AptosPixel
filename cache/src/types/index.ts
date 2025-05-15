export interface Pixel {
  x: number;
  y: number;
  color: string;
  url: string;
  owner?: string;
}

export interface PixelUpdatePayload {
  color?: string;
  url?: string;
}

export interface RedisPixel {
  color: string;
  url: string;
  owner: string;
}

// Aptos-related types
export interface PixelBoughtEvent {
  id: string;
  owner: string;
  argb: string;
  link: string;
}

export interface PixelUpdatedEvent {
  id: string;
  owner: string;
  argb: string;
  link: string;
}

// Type for converting contract coordinates to x,y coordinates
export interface PixelCoordinates {
  x: number;
  y: number;
} 