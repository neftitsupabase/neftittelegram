// Web3 Provider Types
import { BrowserProvider, Signer } from "ethers";

// Note: Window.ethereum type is defined in ethereum.d.ts

// Provider types
export interface Web3ContextType {
  provider: BrowserProvider | null;
  signer: Signer | null;
  account: string | null;
  chainId: number | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  isCorrectNetwork: boolean;
  switchToCorrectNetwork: () => Promise<void>;
}

// Network configuration type
export interface NetworkConfig {
  name: string;
  symbol: string;
  chainId: string;
  rpcUrl: string;
  blockExplorer: string;
  contracts: {
    nft: string;
    staking: string;
    token: string;
  };
}

// Transaction receipt type
export interface TransactionReceipt {
  hash: string;
  blockNumber: number;
  blockHash: string;
  timestamp?: number;
  confirmations: number;
  status: number;
  gasUsed: string;
  effectiveGasPrice: string;
  from: string;
  to: string;
}

// Transaction status enum
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

// Transaction type
export interface Transaction {
  hash: string;
  type: 'burn' | 'mint' | 'stake' | 'unstake' | 'claim' | 'transfer' | 'approve';
  status: TransactionStatus;
  timestamp: number;
  from: string;
  to: string;
  value?: string;
  tokenId?: string;
  receipt?: TransactionReceipt;
  error?: string;
}

// Transaction history type
export interface TransactionHistory {
  transactions: Transaction[];
}

// Wallet info type
export interface WalletInfo {
  address: string;
  chainId: number;
  networkName: string;
  balance: string; // Native token balance (ETH/MATIC)
  isConnected: boolean;
  isCorrectNetwork: boolean;
  providerName?: string; // MetaMask, WalletConnect, etc.
}

// Error types
export enum BlockchainErrorType {
  WALLET_CONNECTION = 'wallet_connection',
  CONTRACT_INTERACTION = 'contract_interaction',
  NETWORK_SWITCH = 'network_switch',
  TRANSACTION_FAILED = 'transaction_failed',
  USER_REJECTED = 'user_rejected',
  UNKNOWN = 'unknown'
}

export interface BlockchainError {
  type: BlockchainErrorType;
  message: string;
  code?: number;
  originalError?: any;
}

// Export fixed ethers type to prevent issues with imported ethers types
export interface EthersFixedTypes {
  BrowserProvider: typeof BrowserProvider;
  Signer: typeof Signer;
}

// Export balance types
export * from './balance';