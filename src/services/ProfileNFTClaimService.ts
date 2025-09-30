import { NFTData } from "@/services/HybridIPFSService";
import { nftClaimTrackingService, NFTClaimStatus } from "@/services/NFTClaimTrackingService";
import { enhancedLazyMintService } from "@/services/EnhancedLazyMintService";
import { simpleLazyMintService } from "@/services/SimpleLazyMintService";
import { CIDPoolBlockchainClaimService } from "@/services/CIDPoolBlockchainClaimService";
import { metaMaskDirectClaimService } from "@/services/MetaMaskDirectClaimService";
import { getSupabaseClient } from "@/lib/supabaseClientManager";
import { getWalletAddress } from "@/utils/authUtils";
import { toast } from "react-hot-toast";

export interface ProfileClaimResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  contractAddress?: string;
  error?: string;
  nftId?: string;
}

export interface NFTWithClaimStatus extends NFTData {
  claimStatus?: NFTClaimStatus;
  canClaim?: boolean;
  isClaimed?: boolean;
}

export class ProfileNFTClaimService {
  private contractAddress = import.meta.env.VITE_NFT_CONTRACT_ADDRESS || "0x8252451036797413e75338E70d294e9ed753AE64";
  private cidPoolService = new CIDPoolBlockchainClaimService();

  /**
   * Get NFT claim status for a specific NFT
   */
  async getNFTClaimStatus(nftId: string): Promise<NFTClaimStatus> {
    try {
      return await nftClaimTrackingService.checkNFTClaimStatus(nftId);
    } catch (error) {
      console.error('Error getting NFT claim status:', error);
      // Return safe default
      return {
        is_claimed: false,
        can_claim: true,
        claimed_blockchain: null,
        claimed_at: null,
        transaction_hash: null,
        wallet_address: getWalletAddress()
      };
    }
  }

  /**
   * Check claim status for multiple NFTs
   */
  async checkMultipleNFTClaimStatus(nfts: NFTData[]): Promise<NFTWithClaimStatus[]> {
    console.log(`🔍 Checking claim status for ${nfts.length} NFTs...`);
    
    const nftsWithStatus = await Promise.all(
      nfts.map(async (nft) => {
        try {
          const claimStatus = await this.getNFTClaimStatus(nft.id);
          return {
            ...nft,
            claimStatus,
            canClaim: claimStatus.can_claim,
            isClaimed: claimStatus.is_claimed,
            // Update NFT properties based on claim status
            onChain: claimStatus.is_claimed || nft.onChain,
            claimed: claimStatus.is_claimed || nft.claimed
          };
        } catch (error) {
          console.error(`Error checking claim status for NFT ${nft.id}:`, error);
          // Return NFT with safe defaults on error
          return {
            ...nft,
            claimStatus: {
              is_claimed: false,
              can_claim: true,
              claimed_blockchain: null,
              claimed_at: null,
              transaction_hash: null,
              wallet_address: getWalletAddress()
            },
            canClaim: true,
            isClaimed: false
          };
        }
      })
    );

    console.log(`✅ Claim status checked for ${nftsWithStatus.length} NFTs`);
    return nftsWithStatus;
  }

  /**
   * Claim NFT on-chain and record in database
   */
  async claimNFTOnChain(nft: NFTData, walletAddress: string, userId?: string): Promise<ProfileClaimResult> {
    try {
      console.log("🚀 Starting Profile NFT claim process...");
      console.log("🎨 NFT:", nft.name, `(ID: ${nft.id})`);
      console.log("📦 NFT Details:", {
        id: nft.id,
        name: nft.name,
        rarity: nft.rarity,
        image: nft.image,
        ipfs_hash: nft.ipfs_hash,
        pinata_hash: nft.pinata_hash
      });
      console.log("👤 Wallet:", walletAddress);
      console.log("🆔 User ID:", userId);

      // Step 1: Check if NFT is already claimed
      const claimStatus = await this.getNFTClaimStatus(nft.id);
      if (claimStatus.is_claimed) {
        return {
          success: false,
          error: `NFT "${nft.name}" has already been claimed on ${claimStatus.claimed_blockchain}`,
          nftId: nft.id
        };
      }

      // Step 2: Use MetaMask direct claim (simple and reliable)
      console.log("🎯 Using MetaMask direct claim (no server-side wallets)...");
      let claimResult;
      
      try {
        console.log("🔄 Step 2a: Trying MetaMaskDirectClaimService...");
        const directResult = await metaMaskDirectClaimService.claimNFTWithMetaMask(nft, walletAddress);
        
        if (directResult.success && directResult.tokenId) {
          claimResult = {
            success: true,
            tokenId: directResult.tokenId,
            transactionHash: directResult.transactionHash,
            contractAddress: directResult.contractAddress || this.contractAddress,
            nftId: nft.id
          };
          console.log("✅ MetaMaskDirectClaimService succeeded!");
          
          // Mark as claimed locally ONLY after transaction is confirmed
          metaMaskDirectClaimService.markAsClaimed(nft.id, walletAddress, directResult.transactionHash || '');
        } else {
          throw new Error(directResult.error || "MetaMask direct claim failed");
        }
      } catch (directError: any) {
        console.error("❌ MetaMask direct claim failed:", directError.message);
        
        // Fallback to SimpleLazyMintService (if needed)
        try {
          console.log("🔄 Step 2b: Fallback to SimpleLazyMintService...");
          const simpleResult = await simpleLazyMintService.claimNFT(nft, walletAddress);
          
          if (simpleResult.success && simpleResult.tokenId) {
            claimResult = {
              success: true,
              tokenId: simpleResult.tokenId,
              transactionHash: simpleResult.transactionHash,
              contractAddress: this.contractAddress,
              nftId: nft.id
            };
            console.log("✅ SimpleLazyMintService succeeded as fallback!");
          } else {
            throw new Error(simpleResult.error || "SimpleLazyMintService failed");
          }
        } catch (simpleError: any) {
          console.error("❌ All claiming methods failed:", simpleError.message);
          claimResult = {
            success: false,
            error: `All claiming methods failed. Direct: ${directError.message}, Simple: ${simpleError.message}`,
            nftId: nft.id
          };
        }
      }

      if (!claimResult.success || !claimResult.tokenId) {
        return {
          success: false,
          error: claimResult.error || "Failed to claim NFT on blockchain",
          nftId: nft.id
        };
      }

      console.log("✅ NFT claimed on blockchain successfully!");
      console.log("🔗 Transaction hash:", claimResult.transactionHash);
      console.log("🆔 Token ID:", claimResult.tokenId);

      // Step 3: Record the claim in the database
      try {
        await this.recordNFTClaimInDatabase(
          nft.id,
          walletAddress,
          claimResult.transactionHash || '',
          claimResult.tokenId,
          this.contractAddress
        );
        console.log("📝 NFT claim recorded in database successfully");
      } catch (dbError) {
        console.error("❌ Failed to record claim in database:", dbError);
        // Don't fail the entire operation if database recording fails
        // The NFT was successfully claimed on blockchain
      }

      // Step 4: Store claim data locally for immediate UI updates
      this.storeClaimDataLocally(nft.id, {
        tokenId: claimResult.tokenId,
        transactionHash: claimResult.transactionHash || '',
        contractAddress: this.contractAddress,
        claimedAt: new Date().toISOString(),
        walletAddress
      });

      return {
        success: true,
        tokenId: claimResult.tokenId,
        transactionHash: claimResult.transactionHash,
        contractAddress: this.contractAddress,
        nftId: nft.id
      };

    } catch (error: any) {
      console.error("❌ Profile NFT claim failed:", error);
      
      // Handle specific error types
      if (error.message?.includes("Claim limit exceeded") || 
          error.message?.includes("DropClaimExceedLimit")) {
        return {
          success: false,
          error: "🚨 Claim Limit Reached! You have already claimed the maximum number of NFTs allowed. Please use a different wallet or contact support.",
          nftId: nft.id
        };
      }
      
      return {
        success: false,
        error: error.message || "Unknown error occurred during NFT claim",
        nftId: nft.id
      };
    }
  }

  /**
   * Record NFT claim in the database
   */
  private async recordNFTClaimInDatabase(
    nftId: string,
    walletAddress: string,
    transactionHash: string,
    tokenId: string,
    contractAddress: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Use the database function to record the claim
      const { data, error } = await supabase.rpc('record_nft_claim', {
        p_nft_id: nftId,
        p_wallet_address: walletAddress,
        p_blockchain: 'ethereum', // We're using Polygon Amoy (Ethereum-compatible)
        p_transaction_hash: transactionHash,
        p_contract_address: contractAddress,
        p_token_id: tokenId
      });

      if (error) {
        console.error('Database function error:', error);
        throw new Error(`Failed to record claim in database: ${error.message}`);
      }

      console.log('✅ NFT claim recorded in database:', data);
    } catch (error) {
      console.error('❌ Error recording NFT claim in database:', error);
      throw error;
    }
  }

  /**
   * Store claim data locally for immediate UI updates
   */
  private storeClaimDataLocally(nftId: string, claimData: any): void {
    try {
      const walletAddress = getWalletAddress();
      if (!walletAddress) return;

      const claimedKey = `claimed_nfts_${walletAddress}`;
      const existingClaims = JSON.parse(localStorage.getItem(claimedKey) || '[]');
      
      // Add new claim data
      const newClaim = {
        nftId,
        ...claimData
      };
      
      // Remove any existing claim for this NFT and add the new one
      const updatedClaims = existingClaims.filter((claim: any) => claim.nftId !== nftId);
      updatedClaims.push(newClaim);
      
      localStorage.setItem(claimedKey, JSON.stringify(updatedClaims));
      console.log('💾 Claim data stored locally for immediate UI update');
    } catch (error) {
      console.error('Error storing claim data locally:', error);
    }
  }

  /**
   * Get locally stored claim data for an NFT
   */
  getLocalClaimData(nftId: string): any | null {
    try {
      const walletAddress = getWalletAddress();
      if (!walletAddress) return null;

      const claimedKey = `claimed_nfts_${walletAddress}`;
      const claims = JSON.parse(localStorage.getItem(claimedKey) || '[]');
      
      return claims.find((claim: any) => claim.nftId === nftId) || null;
    } catch (error) {
      console.error('Error getting local claim data:', error);
      return null;
    }
  }

  /**
   * Check if an NFT can be claimed (convenience method)
   */
  async canClaimNFT(nftId: string): Promise<boolean> {
    try {
      const status = await this.getNFTClaimStatus(nftId);
      return status.can_claim;
    } catch (error) {
      console.error('Error checking if NFT can be claimed:', error);
      return false;
    }
  }

  /**
   * Get formatted claim status message for UI
   */
  async getClaimStatusMessage(nftId: string): Promise<string> {
    try {
      const status = await this.getNFTClaimStatus(nftId);
      
      if (status.can_claim) {
        return "Available to claim";
      } else if (status.is_claimed) {
        return `Claimed on ${status.claimed_blockchain || 'blockchain'}`;
      } else {
        return "Cannot claim";
      }
    } catch (error) {
      console.error('Error getting claim status message:', error);
      return "Status unknown";
    }
  }
}

export const profileNFTClaimService = new ProfileNFTClaimService();
