/**
 * Type definitions for WiFi P2P connections
 */
export interface WiFiP2PDevice {
  deviceName: string;
  deviceAddress: string;
  primaryDeviceType?: string;
  secondaryDeviceType?: string;
  isGroupOwner?: boolean;
  status?: number;
  // Extended properties for QR code connection
  networkName?: string;
  passphrase?: string;
  ip?: string;
  port?: number;
}

export interface WiFiP2PGroup {
  interface: string;
  networkName: string;
  passphrase: string;
  isGroupOwner: boolean;
  ownerAddress: string;
  clients?: WiFiP2PDevice[];
}

/**
 * Type definitions for TCP socket connections
 */
export interface TCPSocket {
  connect: (options: TCPConnectOptions) => void;
  write: (data: string | Uint8Array, encoding?: string) => void;
  end: () => void;
  destroy: () => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  readyState?: string;
}

export interface TCPConnectOptions {
  host: string;
  port: number;
}

export interface TCPServer {
  listen: (options: { port: number; host?: string }) => void;
  close: () => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
}

/**
 * File transfer types
 */
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
}

/**
 * App mode type
 */
export type AppMode = 'selection' | 'receiver' | 'sender' | 'history';

/**
 * Connection status
 */
export type ConnectionStatus = 
  | 'idle' 
  | 'initializing' 
  | 'discovering' 
  | 'connecting' 
  | 'connected' 
  | 'transferring' 
  | 'completed' 
  | 'error';
