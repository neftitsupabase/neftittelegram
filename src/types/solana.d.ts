// Type definitions for Solana wallet providers
interface Window {
  solana?: {
    isPhantom?: boolean;
    isConnected?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    on: (event: string, callback: (...args: any[]) => void) => void;
    removeListener: (event: string, callback: (...args: any[]) => void) => void;
    publicKey?: { toString: () => string };
  };
}

