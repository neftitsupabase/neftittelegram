import { EthereumNFTService } from './EthereumNFTService';
import { SolanaNFTService } from './SolanaNFTService';
import { SuiNFTService } from './SuiNFTService';
import { nftClaimTrackingService } from '../NFTClaimTrackingService';
import { toast } from 'sonner';

// Initialize services
const ethereumNFTService = new EthereumNFTService();
const solanaNFTService = new SolanaNFTService();
const suiNFTService = new SuiNFTService();

export interface BlockchainNFTResult {
  success: boolean;
  tokenId?: string;
  contractAddress?: string;
  txHash: string;
  chain: string;
  explorerUrl: string;
  error?: string;
}

export interface MultichainNFTData {
  name: string;
  description: string;
  image: string;
  rarity: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
}

export enum BlockchainType {
  Ethereum,
  Solana,
  Sui
}

export class MultichainNFTManager {
  
  async claimNFTToBlockchain(
    blockchainType: BlockchainType,
    walletAddress: string,
    nftData: MultichainNFTData
  ): Promise<BlockchainNFTResult> {
    console.log(`🚀 Starting NFT claim to ${this.getChainName(blockchainType)} blockchain`);
    console.log(`📋 NFT Data:`, { name: nftData.name, rarity: nftData.rarity, wallet: walletAddress });
    
    try {
      // Validate inputs
      if (!walletAddress || !nftData.name) {
        throw new Error('Invalid wallet address or NFT data');
      }

      let result: BlockchainNFTResult;
      
      switch (blockchainType) {
        case BlockchainType.Ethereum:
          console.log('📡 Claiming to Ethereum...');
          result = await this.claimToEthereum(walletAddress, nftData);
          break;
        
        case BlockchainType.Solana:
          console.log('📡 Claiming to Solana...');
          result = await this.claimToSolana(nftData);
          break;
        
        case BlockchainType.Sui:
          console.log('📡 Claiming to Sui...');
          result = await this.claimToSui(walletAddress, nftData);
          break;
        
        default:
          throw new Error(`Unsupported blockchain type: ${blockchainType}`);
      }

      if (result.success) {
        console.log(`✅ Successfully claimed NFT to ${result.chain}:`, {
          txHash: result.txHash,
          tokenId: result.tokenId,
          contractAddress: result.contractAddress
        });
      }

      return result;
      
    } catch (error: any) {
      console.error(`❌ Failed to claim NFT to ${this.getChainName(blockchainType)}:`, error);
      return {
        success: false,
        txHash: '',
        chain: this.getChainName(blockchainType),
        explorerUrl: '',
        error: error.message || 'Unknown error occurred during blockchain claiming'
      };
    }
  }

  private async claimToEthereum(walletAddress: string, nftData: MultichainNFTData): Promise<BlockchainNFTResult> {
    try {
      console.log('🔗 Initializing Ethereum NFT Service...');
      const ethereumNFTService = new EthereumNFTService();
      await ethereumNFTService.initialize('metamask');
      
      // Switch to Polygon Amoy testnet (Chain ID: 80002)
      console.log('🔄 Switching to Polygon Amoy testnet...');
      await ethereumNFTService.switchToNetwork(80002);
      
      // Get the currently connected wallet address
      const connectedAddress = await ethereumNFTService.getWalletAddress();
      if (!connectedAddress) {
        throw new Error('No wallet connected. Please connect your MetaMask wallet.');
      }

      // Use the connected wallet address for minting
      const targetAddress = connectedAddress;

      // Get gas estimate
      const gasEstimate = await ethereumNFTService.getGasEstimate(targetAddress, nftData);
      toast.info(`Estimated gas cost: ${gasEstimate.estimatedCost} MATIC`);

      // Mint NFT to the connected wallet
      const result = await ethereumNFTService.mintNFT(targetAddress, nftData);
      
      return {
        success: true,
        tokenId: result.tokenId,
        contractAddress: result.contractAddress,
        txHash: result.txHash,
        chain: 'Ethereum',
        explorerUrl: `https://amoy.polygonscan.com/tx/${result.txHash}` // Polygon Amoy testnet explorer
      };
      
    } catch (error: any) {
      throw new Error(`Ethereum minting failed: ${error.message}`);
    }
  }

  private async claimToSolana(nftData: MultichainNFTData): Promise<BlockchainNFTResult> {
    try {
      // Initialize Solana service
      await solanaNFTService.initialize();
      
      // Get cost estimate
      const costEstimate = await solanaNFTService.estimateTransactionCost();
      toast.info(`Estimated cost: ${costEstimate.estimatedCost} SOL`);

      // Mint NFT
      const result = await solanaNFTService.mintNFT(nftData);
      
      return {
        success: true,
        tokenId: result.mintAddress,
        contractAddress: result.mintAddress,
        txHash: result.txHash,
        chain: 'Solana',
        explorerUrl: `https://explorer.solana.com/tx/${result.txHash}?cluster=devnet` // Solana devnet explorer
      };
      
    } catch (error: any) {
      throw new Error(`Solana minting failed: ${error.message}`);
    }
  }

  private async claimToSui(walletAddress: string, nftData: MultichainNFTData): Promise<BlockchainNFTResult> {
    try {
      // Initialize Sui service
      await suiNFTService.initialize();
      
      // Get gas estimate
      const gasEstimate = await suiNFTService.estimateGas();
      toast.info(`Estimated gas cost: ${gasEstimate.estimatedCost} SUI`);

      // Mint NFT
      const result = await suiNFTService.mintNFT(walletAddress, nftData);
      
      return {
        success: true,
        tokenId: result.objectId,
        contractAddress: result.objectId,
        txHash: result.txHash,
        chain: 'Sui',
        explorerUrl: `https://suiexplorer.com/txblock/${result.txHash}?network=testnet` // Sui testnet explorer
      };
      
    } catch (error: any) {
      throw new Error(`Sui minting failed: ${error.message}`);
    }
  }

  private getChainName(blockchainType: BlockchainType): string {
    switch (blockchainType) {
      case BlockchainType.Ethereum:
        return 'Ethereum';
      case BlockchainType.Solana:
        return 'Solana';
      case BlockchainType.Sui:
        return 'Sui';
      default:
        return 'Unknown';
    }
  }

  // Helper method to convert wallet type to blockchain type
  static walletTypeToBlockchainType(walletType: 'metamask' | 'walletconnect' | 'phantom' | 'sui'): BlockchainType {
    switch (walletType) {
      case 'metamask':
      case 'walletconnect':
        return BlockchainType.Ethereum;
      case 'phantom':
        return BlockchainType.Solana;
      case 'sui':
        return BlockchainType.Sui;
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }

  async validateWalletConnection(walletType: 'metamask' | 'walletconnect' | 'phantom' | 'sui'): Promise<boolean> {
    try {
      switch (walletType) {
        case 'metamask':
          return window.ethereum && window.ethereum.isMetaMask;
        case 'walletconnect':
          return window.ethereum !== undefined;
        case 'phantom':
          return window.solana && window.solana.isPhantom;
        case 'sui':
          return window.suiWallet !== undefined;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  async getWalletBalance(walletType: 'metamask' | 'walletconnect' | 'phantom' | 'sui'): Promise<string> {
    try {
      switch (walletType) {
        case 'metamask':
        case 'walletconnect':
          await ethereumNFTService.initialize();
          return await ethereumNFTService.getBalance();
        case 'phantom':
          await solanaNFTService.initialize();
          return await solanaNFTService.getBalance();
        case 'sui':
          await suiNFTService.initialize();
          return await suiNFTService.getBalance();
        default:
          return '0';
      }
    } catch (error) {
      console.error(`Failed to get balance for ${walletType}:`, error);
      return '0';
    }
  }
}

export const multichainNFTManager = new MultichainNFTManager();
