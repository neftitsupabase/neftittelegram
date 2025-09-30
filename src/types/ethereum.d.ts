// Type definitions for Ethereum provider
interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (request: { method: string; params?: Array<any> }) => Promise<any>;
    on: (event: string, callback: (...args: any[]) => void) => void;
    removeListener: (event: string, callback: (...args: any[]) => void) => void;
    selectedAddress: string | null;
    chainId: string | null;
    isConnected: () => boolean;
    networkVersion: string | null;
    _metamask?: {
      isUnlocked: () => Promise<boolean>;
    };
  };
} 