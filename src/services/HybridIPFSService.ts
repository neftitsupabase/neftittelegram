import axios from 'axios';

// Pinata API types
interface PinataAPI {
  pinFileToIPFS(file: File | Blob, options?: any): Promise<{ IpfsHash: string; PinSize: number; Timestamp: string }>;
  pinJSONToIPFS(json: any, options?: any): Promise<{ IpfsHash: string; PinSize: number; Timestamp: string }>;
  unpin(hashToUnpin: string): Promise<{ success: boolean }>;
}

export interface IPFSMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
}

export interface NFTData {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  tier?: number;
  collection?: string;
  burnValue?: number;
  wallet_address: string;
  ipfs_hash?: string;
  pinata_hash?: string; // Pinata hash
  contractAddress?: string;
  tokenId?: string;
  owner?: string;
  chain?: string;
  token_uri?: string;
  metadata_uri?: string;
  claimed?: boolean;
  created_at?: string;
  transactionHash?: string; // Blockchain transaction hash
  onChain?: boolean; // Whether NFT is minted on blockchain
  mintedAt?: string; // When NFT was minted to blockchain
  isStaked?: boolean; // Whether NFT is currently staked
  fallback_images?: string[]; // Array of fallback IPFS gateway URLs
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

interface StorageResult {
  pinata_hash: string;
  primary_hash: string;
  storage_provider: 'pinata';
  image_url: string;
}

class HybridIPFSService {
  private pinataApiKey: string | null;
  private pinataSecretKey: string | null;
  private pinataGateway: string;

  constructor() {
    // Resolve Pinata credentials from environment
    this.pinataApiKey = import.meta.env.VITE_PINATA_API_KEY || '8ba2dcf332749804d589';
    this.pinataSecretKey = import.meta.env.VITE_PINATA_SECRET_API_KEY || '3d413242a71d1c07cd1a67c6b0956738ccea600c80398e83a4a68b1c20b72ac5';

    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('Pinata API credentials not found. Using fallback credentials.');
    }

    // Gateway URL
    this.pinataGateway = 'https://gateway.pinata.cloud';
  }

  /**
   * Upload content using Pinata exclusively
   */
  async uploadWithPinataStrategy(
    content: any, 
    filename: string, 
    contentType: 'metadata' | 'image' | 'user-data' | 'burn-record'
  ): Promise<StorageResult> {
    try {
      // Upload to Pinata
      const pinataHash = await this.uploadToPinata(content, filename, contentType);
      const imageUrl = `${this.pinataGateway}/ipfs/${pinataHash}`;

      return {
        primary_hash: pinataHash,
        pinata_hash: pinataHash,
        storage_provider: 'pinata',
        image_url: imageUrl
      };

    } catch (error) {
      console.error(`Pinata upload failed for ${filename}:`, error);
      throw new Error(`Failed to upload ${filename} to Pinata: ${error}`);
    }
  }

  /**
   * Upload to Pinata
   */
  private async uploadToPinata(content: any, filename: string, contentType: 'image' | 'metadata' | 'user-data' | 'burn-record'): Promise<string> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      throw new Error('Pinata credentials not configured');
    }

    try {
      const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
      const formData = new FormData();

      if (contentType === 'image' && (content instanceof File || content instanceof Blob)) {
        // Upload image file directly
        formData.append('file', content, filename);
      } else {
        // Upload JSON data (metadata, user-data, burn-record)
        const jsonBlob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
        formData.append('file', jsonBlob, `${filename}.json`);
      }

      // Add metadata
      formData.append('pinataMetadata', JSON.stringify({
        name: filename,
        keyvalues: {
          contentType: contentType,
          uploadedBy: 'NEFTIT-Platform'
        }
      }));

      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        }
      });

      return response.data.IpfsHash;
    } catch (error) {
      console.error('Pinata upload failed:', error);
      throw error;
    }
  }



  /**
   * Retrieve content from IPFS using multiple gateways for reliability
   */
  async getContentFromIPFS(primaryHash: string): Promise<any> {
    const gateways = [
      this.pinataGateway,
      'https://ipfs.io',
      'https://cloudflare-ipfs.com'
    ];
    
    // Try each gateway until one succeeds
    for (const gateway of gateways) {
      try {
        const response = await axios.get(`${gateway}/ipfs/${primaryHash}`, { 
          timeout: 8000,
          headers: {
            'Accept': 'application/json'
          }
        });
        return response.data;
      } catch (error) {
        console.warn(`Failed to fetch from ${gateway}:`, error);
      }
    }

    throw new Error(`Failed to retrieve content from IPFS with hash: ${primaryHash}`);
  }

  /**
   * Upload NFT metadata using Pinata
   */
  async uploadNFTMetadata(metadata: IPFSMetadata, name: string): Promise<StorageResult> {
    return await this.uploadWithPinataStrategy(metadata, `${name}-metadata`, 'metadata');
  }

  /**
   * Upload user data using Pinata
   */
  async uploadUserData(userData: any, walletAddress: string): Promise<StorageResult> {
    return await this.uploadWithPinataStrategy(userData, `user-data-${walletAddress}`, 'user-data');
  }

  /**
   * Upload burn record using Pinata
   */
  async uploadBurnRecord(burnData: any, burnId: string): Promise<StorageResult> {
    return await this.uploadWithPinataStrategy(burnData, `burn-record-${burnId}`, 'burn-record');
  }

  /**
   * Upload image using Pinata
   */
  async uploadImage(imageFile: File | Blob, filename: string): Promise<StorageResult> {
    return await this.uploadWithPinataStrategy(imageFile, filename, 'image');
  }

  /**
   * Upload NFT image using Pinata
   */
  async uploadNFTImage(imageFile: File | Blob, filename: string): Promise<StorageResult> {
    return await this.uploadWithPinataStrategy(imageFile, `nft-${filename}`, 'image');
  }

  /**
   * Get IPFS URL using Pinata gateway
   */
  getIPFSUrl(hash: string): string {
    return `${this.pinataGateway}/ipfs/${hash}`;
  }

  /**
   * Unpin/delete content from Pinata
   */
  async unpinFromPinata(hash: string): Promise<void> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      throw new Error('Pinata credentials not configured');
    }

    try {
      const response = await axios.delete(`https://api.pinata.cloud/pinning/unpin/${hash}`, {
        headers: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        }
      });

      if (response.status === 200) {
        console.log(`Successfully unpinned ${hash} from Pinata`);
      } else {
        throw new Error(`Pinata unpin failed with status: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`Hash ${hash} not found on Pinata (may already be deleted)`);
        return; // Not an error if already deleted
      }
      throw new Error(`Failed to unpin ${hash} from Pinata: ${error.message}`);
    }
  }

  /**
   * Check service configuration
   */
  isConfigured(): boolean {
    return !!(this.pinataApiKey && this.pinataSecretKey);
  }

  /**
   * Get configuration status
   */
  getConfigurationStatus(): {
    pinata: boolean;
    supabaseMapping: boolean;
  } {
    const hasPinata = !!(this.pinataApiKey && this.pinataSecretKey);
    const hasSupabaseMapping = true; // Already integrated in your system
    
    return {
      pinata: hasPinata,
      supabaseMapping: hasSupabaseMapping
    };
  }

  /**
   * Get fallback gateway URLs for resilience
   */
  getFallbackIPFSUrls(cid: string): string[] {
    return [
      `${this.pinataGateway}/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`
    ];
  }

  /**
   * Unpin content from Pinata
   */
  async unpinContent(ipfsHash: string): Promise<void> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('Cannot unpin content: Pinata API keys not configured');
      return;
    }

    try {
      await axios.delete(
        `https://api.pinata.cloud/pinning/unpin/${ipfsHash}`,
        {
          headers: {
            'pinata_api_key': this.pinataApiKey,
            'pinata_secret_api_key': this.pinataSecretKey,
          },
        }
      );
      console.log(`Successfully unpinned content: ${ipfsHash}`);
    } catch (error) {
      console.error('Error unpinning content from IPFS:', error);
      // Don't throw error as unpinning failure shouldn't break the burn process
    }
  }
}

export const hybridIPFSService = new HybridIPFSService();
export default hybridIPFSService;
