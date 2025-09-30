import { getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";
import { ethers } from "ethers";

export interface UserWalletInfo {
  primaryWallet: string;
  linkedWallets: Array<{
    address: string;
    wallet_type: string;
    chain: string;
  }>;
  evmWallet?: string;
  solanaWallet?: string;
  suiWallet?: string;
}

export interface NFTChainInfo {
  chain: 'ethereum' | 'solana' | 'sui';
  targetChain?: string;
  network?: string;
}

export class AutoMinterRoleService {
  private contractAddress = "0x8252451036797413e75338E70d294e9ed753AE64";
  private minterRoleHash = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

  /**
   * Get user's wallet addresses from Supabase based on NFT chain
   */
  async getUserWalletAddresses(userId: string, fallbackWalletAddress?: string): Promise<UserWalletInfo> {
    try {
      // If userId is empty, use fallback wallet address
      if (!userId || userId.trim() === '') {
        if (!fallbackWalletAddress) {
          throw new Error('No user ID provided and no fallback wallet address available');
        }
        
        console.log('⚠️ Empty user ID, using fallback wallet address:', fallbackWalletAddress);
        return {
          primaryWallet: fallbackWalletAddress,
          linkedWallets: [],
          evmWallet: fallbackWalletAddress
        };
      }

      const supabase = getWalletSupabaseClient(fallbackWalletAddress || userId);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('wallet_address, linked_wallet_addresses, wallet_type')
        .eq('id', userId)
        .single();

      if (error || !user) {
        // If user not found in database, use fallback wallet address
        if (fallbackWalletAddress) {
          console.log('⚠️ User not found in database, using fallback wallet address:', fallbackWalletAddress);
          return {
            primaryWallet: fallbackWalletAddress,
            linkedWallets: [],
            evmWallet: fallbackWalletAddress
          };
        }
        throw new Error(`User not found: ${error?.message}`);
      }

      const linkedWallets = user.linked_wallet_addresses || [];
      const evmWallet = this.findWalletByType(linkedWallets, ['metamask', 'coinbase', 'walletconnect']);
      const solanaWallet = this.findWalletByType(linkedWallets, ['phantom', 'solflare']);
      const suiWallet = this.findWalletByType(linkedWallets, ['sui']);

      return {
        primaryWallet: user.wallet_address,
        linkedWallets: linkedWallets,
        evmWallet: evmWallet || (user.wallet_type === 'metamask' ? user.wallet_address : undefined),
        solanaWallet,
        suiWallet
      };
    } catch (error) {
      console.error('Failed to get user wallet addresses:', error);
      throw error;
    }
  }

  /**
   * Determine the target wallet address based on NFT chain
   */
  getTargetWalletAddress(userWallets: UserWalletInfo, nftChain: NFTChainInfo): string | null {
    switch (nftChain.chain) {
      case 'ethereum':
        return userWallets.evmWallet || userWallets.primaryWallet;
      case 'solana':
        return userWallets.solanaWallet;
      case 'sui':
        return userWallets.suiWallet;
      default:
        return userWallets.primaryWallet;
    }
  }

  /**
   * Check if user has minter role on the contract
   */
  async checkMinterRole(walletAddress: string): Promise<boolean> {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/"
      );
      const signer = new ethers.Wallet(import.meta.env.VITE_PRIVATE_KEY!, provider);
      
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
      });

      const contract = await sdk.getContract(this.contractAddress);
      
      const hasRole = await contract.call("hasRole", [
        this.minterRoleHash,
        walletAddress
      ]);

      return hasRole;
    } catch (error) {
      console.error('Failed to check minter role:', error);
      return false;
    }
  }

  /**
   * Grant minter role to user's wallet
   */
  async grantMinterRole(walletAddress: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const provider = new ethers.providers.JsonRpcProvider(import.meta.env.VITE_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/");
      const signer = new ethers.Wallet(import.meta.env.VITE_PRIVATE_KEY!, provider);
      
      const sdk = ThirdwebSDK.fromSigner(signer, PolygonAmoyTestnet, {
        clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
      });

      const contract = await sdk.getContract(this.contractAddress);
      
      // Check if already has role
      const hasRole = await this.checkMinterRole(walletAddress);
      if (hasRole) {
        console.log(`✅ Wallet ${walletAddress} already has minter role`);
        return { success: true };
      }

      // Grant the role
      const tx = await contract.call("grantRole", [
        this.minterRoleHash,
        walletAddress
      ]);

      console.log(`✅ Minter role granted to ${walletAddress}`);
      console.log(`🔗 Transaction hash: ${tx.receipt.transactionHash}`);

      return { 
        success: true, 
        txHash: tx.receipt.transactionHash 
      };
    } catch (error: any) {
      console.error('Failed to grant minter role:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Auto-grant minter role when user is granted NFT off-chain
   */
  async autoGrantMinterRole(userId: string, nftChain: NFTChainInfo, fallbackWalletAddress?: string): Promise<{ success: boolean; walletAddress?: string; error?: string }> {
    try {
      console.log(`🔑 Auto-granting minter role for user ${userId} on ${nftChain.chain} chain`);

      // Get user's wallet addresses
      const userWallets = await this.getUserWalletAddresses(userId, fallbackWalletAddress);
      
      // Get target wallet address based on NFT chain
      const targetWallet = this.getTargetWalletAddress(userWallets, nftChain);
      
      if (!targetWallet) {
        return {
          success: false,
          error: `No ${nftChain.chain} wallet found for user. Please connect a ${nftChain.chain} wallet first.`
        };
      }

      // Only grant role for EVM chains (Ethereum/Polygon)
      if (nftChain.chain !== 'ethereum') {
        console.log(`ℹ️ Skipping minter role grant for ${nftChain.chain} chain (not EVM)`);
        return {
          success: true,
          walletAddress: targetWallet
        };
      }

      // Grant minter role
      const result = await this.grantMinterRole(targetWallet);
      
      if (result.success) {
        console.log(`✅ Auto-granted minter role to ${targetWallet}`);
        return {
          success: true,
          walletAddress: targetWallet
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error: any) {
      console.error('Failed to auto-grant minter role:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper method to find wallet by type
   */
  private findWalletByType(linkedWallets: any[], types: string[]): string | null {
    for (const wallet of linkedWallets) {
      if (types.includes(wallet.wallet_type?.toLowerCase())) {
        return wallet.address;
      }
    }
    return null;
  }

  /**
   * Extract chain information from NFT data
   */
  extractNFTChainInfo(nftData: any): NFTChainInfo {
    // Check if NFT has explicit chain info
    if (nftData.chain) {
      return {
        chain: nftData.chain,
        targetChain: nftData.targetChain,
        network: nftData.network
      };
    }

    // Check if NFT has target chain info
    if (nftData.targetChain) {
      const targetChain = nftData.targetChain.toLowerCase();
      if (targetChain.includes('ethereum') || targetChain.includes('polygon')) {
        return { chain: 'ethereum', targetChain: nftData.targetChain };
      } else if (targetChain.includes('solana')) {
        return { chain: 'solana', targetChain: nftData.targetChain };
      } else if (targetChain.includes('sui')) {
        return { chain: 'sui', targetChain: nftData.targetChain };
      }
    }

    // Default to Ethereum for EVM chains
    return { chain: 'ethereum' };
  }
}

export const autoMinterRoleService = new AutoMinterRoleService();
