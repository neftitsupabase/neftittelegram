// import axios from 'axios';

// export interface IPFSMetadata {
//   name: string;
//   description: string;
//   image: string;
//   attributes: Array<{
//     trait_type: string;
//     value: string | number;
//   }>;
//   external_url?: string;
//   animation_url?: string;
// }

export interface NFTData {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: string;
  tier?: number;
  collection?: string;
  burnValue?: number;
  wallet_address: string; // Updated from owner_wallet for consistency
  ipfs_hash?: string;
  contractAddress?: string;
  tokenId?: string;
  owner?: string;
  chain?: string;
  token_uri?: string;
  metadata_uri?: string;
  claimed?: boolean;
  created_at?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// class IPFSService {
//   private pinataApiKey: string;
//   private pinataSecretApiKey: string;
//   private pinataGateway: string;

//   constructor() {
//     this.pinataApiKey = import.meta.env.VITE_PINATA_API_KEY || '';
//     this.pinataSecretApiKey = import.meta.env.VITE_PINATA_SECRET_API_KEY || '';
//     this.pinataGateway = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    
//     if (!this.pinataApiKey || !this.pinataSecretApiKey) {
//       console.warn('IPFS Service: Pinata API keys not configured. Some features may not work.');
//     }
//   }

//   /**
//    * Upload image to IPFS via Pinata
//    */
//   async uploadImage(imageFile: File | Blob, filename: string): Promise<string> {
//     if (!this.pinataApiKey || !this.pinataSecretApiKey) {
//       throw new Error('Pinata API keys not configured');
//     }

//     const formData = new FormData();
//     formData.append('file', imageFile, filename);

//     const metadata = JSON.stringify({
//       name: filename,
//       keyvalues: {
//         type: 'nft-image'
//       }
//     });
//     formData.append('pinataMetadata', metadata);

//     const options = JSON.stringify({
//       cidVersion: 0,
//     });
//     formData.append('pinataOptions', options);

//     try {
//       const response = await axios.post(
//         'https://api.pinata.cloud/pinning/pinFileToIPFS',
//         formData,
//         {
//           maxBodyLength: Infinity,
//           headers: {
//             'Content-Type': `multipart/form-data`,
//             'pinata_api_key': this.pinataApiKey,
//             'pinata_secret_api_key': this.pinataSecretApiKey,
//           },
//         }
//       );

//       return response.data.IpfsHash;
//     } catch (error) {
//       console.error('Error uploading image to IPFS:', error);
//       throw new Error('Failed to upload image to IPFS');
//     }
//   }

//   /**
//    * Upload JSON metadata to IPFS via Pinata
//    */
//   async uploadMetadata(metadata: IPFSMetadata, name: string): Promise<string> {
//     if (!this.pinataApiKey || !this.pinataSecretApiKey) {
//       throw new Error('Pinata API keys not configured');
//     }

//     const pinataMetadata = {
//       name: `${name}-metadata`,
//       keyvalues: {
//         type: 'nft-metadata'
//       }
//     };

//     const options = {
//       cidVersion: 0,
//     };

//     try {
//       const response = await axios.post(
//         'https://api.pinata.cloud/pinning/pinJSONToIPFS',
//         {
//           pinataContent: metadata,
//           pinataMetadata,
//           pinataOptions: options,
//         },
//         {
//           headers: {
//             'Content-Type': 'application/json',
//             'pinata_api_key': this.pinataApiKey,
//             'pinata_secret_api_key': this.pinataSecretApiKey,
//           },
//         }
//       );

//       return response.data.IpfsHash;
//     } catch (error) {
//       console.error('Error uploading metadata to IPFS:', error);
//       throw new Error('Failed to upload metadata to IPFS');
//     }
//   }

//   /**
//    * Create NFT with IPFS metadata
//    */
//   async createNFTOnIPFS(nftData: Omit<NFTData, 'id' | 'ipfs_hash' | 'token_uri'>): Promise<{ ipfs_hash: string; token_uri: string }> {
//     try {
//       // Create ERC-721 compliant metadata
//       const metadata: IPFSMetadata = {
//         name: nftData.name,
//         description: `A ${nftData.rarity} NFT from the ${nftData.collection} collection with tier ${nftData.tier} and burn value ${nftData.burnValue}.`,
//         image: nftData.image.startsWith('http') ? nftData.image : `${this.pinataGateway}/ipfs/${nftData.image}`,
//         attributes: [
//           {
//             trait_type: 'Rarity',
//             value: nftData.rarity
//           },
//           {
//             trait_type: 'Tier',
//             value: nftData.tier
//           },
//           {
//             trait_type: 'Collection',
//             value: nftData.collection
//           },
//           {
//             trait_type: 'Burn Value',
//             value: nftData.burnValue
//           }
//         ],
//         external_url: `https://neftit.com/nft/${nftData.name.replace(/\s+/g, '-').toLowerCase()}`
//       };

//       // Upload metadata to IPFS
//       const ipfsHash = await this.uploadMetadata(metadata, nftData.name);
//       const tokenUri = `${this.pinataGateway}/ipfs/${ipfsHash}`;

//       return { ipfs_hash: ipfsHash, token_uri: tokenUri };
//     } catch (error) {
//       console.error('Error creating NFT on IPFS:', error);
//       throw new Error('Failed to create NFT on IPFS');
//     }
//   }

//   /**
//    * Retrieve metadata from IPFS
//    */
//   async getMetadataFromIPFS(ipfsHash: string): Promise<IPFSMetadata> {
//     try {
//       const response = await axios.get(`${this.pinataGateway}/ipfs/${ipfsHash}`);
//       return response.data;
//     } catch (error) {
//       console.error('Error retrieving metadata from IPFS:', error);
//       throw new Error('Failed to retrieve metadata from IPFS');
//     }
//   }

//   /**
//    * Get IPFS URL from hash
//    */
//   getIPFSUrl(ipfsHash: string): string {
//     return `${this.pinataGateway}/ipfs/${ipfsHash}`;
//   }

//   /**
//    * Delete/unpin content from IPFS
//    */
//   async unpinContent(ipfsHash: string): Promise<void> {
//     if (!this.pinataApiKey || !this.pinataSecretApiKey) {
//       console.warn('Cannot unpin content: Pinata API keys not configured');
//       return;
//     }

//     try {
//       await axios.delete(
//         `https://api.pinata.cloud/pinning/unpin/${ipfsHash}`,
//         {
//           headers: {
//             'pinata_api_key': this.pinataApiKey,
//             'pinata_secret_api_key': this.pinataSecretApiKey,
//           },
//         }
//       );
//       console.log(`Successfully unpinned content: ${ipfsHash}`);
//     } catch (error) {
//       console.error('Error unpinning content from IPFS:', error);
//       // Don't throw error as unpinning failure shouldn't break the burn process
//     }
//   }

//   /**
//    * Check if IPFS service is properly configured
//    */
//   isConfigured(): boolean {
//     return !!(this.pinataApiKey && this.pinataSecretApiKey);
//   }

//   /**
//    * Add NFT to user's collection (for campaign end distribution)
//    */
//   async addNFTToUserCollection(walletAddress: string, nftData: NFTData): Promise<boolean> {
//     try {
//       console.log(`Adding NFT to user collection: ${walletAddress}`, nftData.id);
      
//       // Store NFT data in localStorage for now (in production, this would be stored in a database)
//       const storageKey = `user_nfts_${walletAddress}`;
//       const existingNFTs = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
//       // Check if NFT already exists
//       const existingIndex = existingNFTs.findIndex((nft: NFTData) => nft.id === nftData.id);
      
//       if (existingIndex >= 0) {
//         // Update existing NFT
//         existingNFTs[existingIndex] = nftData;
//       } else {
//         // Add new NFT
//         existingNFTs.push(nftData);
//       }
      
//       localStorage.setItem(storageKey, JSON.stringify(existingNFTs));
//       console.log(`Successfully added NFT to user collection: ${nftData.id}`);
      
//       return true;
//     } catch (error) {
//       console.error('Error adding NFT to user collection:', error);
//       return false;
//     }
//   }

//   /**
//    * Get user's NFT collection
//    */
//   async getUserNFTCollection(walletAddress: string): Promise<NFTData[]> {
//     try {
//       const storageKey = `user_nfts_${walletAddress}`;
//       const nfts = JSON.parse(localStorage.getItem(storageKey) || '[]');
//       return nfts;
//     } catch (error) {
//       console.error('Error getting user NFT collection:', error);
//       return [];
//     }
//   }

//   /**
//    * Remove NFT from user's collection (for burning)
//    */
//   async removeNFTFromUserCollection(walletAddress: string, nftId: string): Promise<boolean> {
//     try {
//       const storageKey = `user_nfts_${walletAddress}`;
//       const existingNFTs = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
//       const filteredNFTs = existingNFTs.filter((nft: NFTData) => nft.id !== nftId);
//       localStorage.setItem(storageKey, JSON.stringify(filteredNFTs));
      
//       console.log(`Successfully removed NFT from user collection: ${nftId}`);
//       return true;
//     } catch (error) {
//       console.error('Error removing NFT from user collection:', error);
//       return false;
//     }
//   }

//   /**
//    * Create NFT with enhanced metadata for campaign rewards
//    */
//   async createCampaignNFT(nftData: NFTData): Promise<NFTData> {
//     try {
//       // If IPFS is configured, create metadata on IPFS
//       if (this.isConfigured() && nftData.attributes) {
//         const metadata: IPFSMetadata = {
//           name: nftData.name,
//           description: nftData.description || `A ${nftData.rarity} NFT reward`,
//           image: nftData.image,
//           attributes: nftData.attributes
//         };

//         const ipfsHash = await this.uploadMetadata(metadata, nftData.name);
//         nftData.ipfs_hash = ipfsHash;
//         nftData.metadata_uri = `${this.pinataGateway}/ipfs/${ipfsHash}`;
//         nftData.token_uri = nftData.metadata_uri;
//       }

//       return nftData;
//     } catch (error) {
//       console.error('Error creating campaign NFT:', error);
//       // Return NFT data even if IPFS upload fails
//       return nftData;
//     }
//   }
// }

// export const ipfsService = new IPFSService();
// export default ipfsService;
