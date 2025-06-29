import debug from 'debug';

// Debug loggers
export const createLogger = (namespace: string) => debug(`meetassist:${namespace}`);

// Utility functions
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const extractMeetingId = (url: string): string | null => {
  const match = url.match(/meet\.google\.com\/([a-z0-9-]+)/);
  return match ? match[1] : null;
};

export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[<>:"/\\|?*]/g, '-').trim();
};

export const chunkArrayBuffer = (buffer: ArrayBuffer, chunkSize: number): ArrayBuffer[] => {
  const chunks: ArrayBuffer[] = [];
  const view = new Uint8Array(buffer);
  
  for (let i = 0; i < view.length; i += chunkSize) {
    const chunk = view.slice(i, i + chunkSize);
    chunks.push(chunk.buffer);
  }
  
  return chunks;
};

export const mergeArrayBuffers = (buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  
  return result.buffer;
};

// Date utilities
export const createMeetingFolder = (meetingId: string, startTime: Date): string => {
  const dateStr = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${dateStr}-${meetingId}`;
};

export const isBusinessHours = (date: Date = new Date()): boolean => {
  const hour = date.getHours();
  const day = date.getDay();
  return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
};

// WebSocket utilities
export const createRetryDelay = (attempt: number): number => {
  return Math.min(1000 * Math.pow(2, attempt), 30000); // Cap at 30 seconds
};

export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};