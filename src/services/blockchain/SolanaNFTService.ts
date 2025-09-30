import { 
  Connection, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram
} from '@solana/web3.js';
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { toast } from 'sonner';
// Temporarily disabled due to bundlrStorage import issues
// import { 
//   Metaplex, 
//   keypairIdentity, 
//   bundlrStorage,
//   toMetaplexFile
// } from '@metaplex-foundation/js';

export interface SolanaNFTData {
  name: string;
  description: string;
  image: string;
  rarity: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
}

export class SolanaNFTService {
  private connection: Connection;
  private wallet: any = null;

  constructor() {
    // Use Solana devnet for testing
    this.connection = new Connection(clusterApiUrl('devnet'));
  }

  async initialize() {
    try {
      // Temporarily return success
      return true;
      
      // Check if Phantom wallet is available
      // if (!window.solana || !window.solana.isPhantom) {
      //   throw new Error('Phantom wallet not installed');
      // }

      // Connect to Phantom wallet
      // const response = await window.solana.connect();
      // this.wallet = window.solana;

      // return true;
    } catch (error) {
      console.error('Failed to initialize Solana service:', error);
      throw error;
    }
  }

  async mintNFT(nftData: SolanaNFTData): Promise<{ mintAddress: string; txHash: string }> {
    // Temporarily return mock data
    toast.info('Solana NFT minting temporarily disabled - Metaplex import issues');
    return {
      mintAddress: 'SoLaNaMockMintAddress123456789',
      txHash: 'SoLaNaMockTxHash123456789'
    };

    // Commented out until Metaplex imports are fixed
    /*
    try {
      // Upload metadata to Arweave via Bundlr
      const { uri } = await this.metaplex.nfts().uploadMetadata({
        name: nftData.name,
        description: nftData.description,
        image: nftData.image,
        attributes: nftData.attributes,
        properties: {
          files: [
            {
              uri: nftData.image,
              type: "image/png",
            },
          ],
          category: "image",
        },
      });

      toast.info('Creating NFT on Solana blockchain...');

      // Create the NFT using Metaplex
      const { nft } = await this.metaplex.nfts().create({
        uri,
        name: nftData.name,
        sellerFeeBasisPoints: 500, // 5% royalty
        symbol: 'NEFTIT',
        creators: [
          {
            address: this.wallet.publicKey,
            share: 100,
          },
        ],
        isMutable: false,
      });

      // Get the transaction signature from the creation
      const signature = nft.mint.address.toString();

      toast.success(`NFT successfully minted on Solana!`);

      return {
        mintAddress: nft.mint.address.toString(),
        txHash: signature
      };

    } catch (error: any) {
      console.error('Real Solana minting failed:', error);
      
      // Handle specific Solana errors
      if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient SOL balance for minting');
      } else if (error.message?.includes('User rejected')) {
        throw new Error('Transaction rejected by user');
      } else if (error.message?.includes('blockhash not found')) {
        throw new Error('Network congestion. Please try again.');
      }
      
      throw error;
    }
    */
  }

  async getWalletAddress(): Promise<string> {
    // Temporarily return mock address
    return 'SoLaNaMockWalletAddress123456789';
  }

  async getBalance(): Promise<string> {
    // Temporarily return mock balance
    return '1.5'; // SOL
  }

  async estimateTransactionCost(): Promise<{ estimatedCost: string }> {
    // Solana transaction costs are generally very low (~0.000005 SOL)
    return {
      estimatedCost: '0.000005' // SOL
    };
  }
}

export const solanaNFTService = new SolanaNFTService();
