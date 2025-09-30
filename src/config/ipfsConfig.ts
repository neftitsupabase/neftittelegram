/**
 * IPFS Gateway Configuration
 * Ordered by reliability and speed
 * Uses proxy URLs in development to avoid CORS issues
 */
const isDevelopment = import.meta.env.DEV;

export const IPFS_GATEWAYS = isDevelopment ? [
  // Development proxy URLs (no CORS issues)
  "/api/ipfs/",
  "/api/ipfs-pinata/",
  "/api/ipfs-cloudflare/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://4everland.io/ipfs/"
] : [
  // Production URLs
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://4everland.io/ipfs/"
] as const;

export const PRIMARY_IPFS_GATEWAY = IPFS_GATEWAYS[0];

/**
 * Get IPFS URL with primary gateway
 */
export function getIPFSUrl(hash: string): string {
  return `${PRIMARY_IPFS_GATEWAY}${hash}`;
}

/**
 * Get all possible IPFS URLs for a hash (for fallback purposes)
 */
export function getAllIPFSUrls(hash: string): string[] {
  return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
}

/**
 * Extract IPFS hash from various URL formats
 */
export const extractIPFSHash = (url: string): string | null => {
  if (!url) return null;
  
  // Match IPFS hash pattern (Qm followed by 44 characters)
  const ipfsHashMatch = url.match(/Qm[1-9A-HJ-NP-Za-km-z]{44}/);
  return ipfsHashMatch ? ipfsHashMatch[0] : null;
};

/**
 * Update old IPFS gateway URLs to use the improved gateway configuration
 * Extracts IPFS hash from old URLs and generates new URL with primary gateway
 */
export const updateIPFSUrl = (oldUrl: string): string => {
  if (!oldUrl) return oldUrl;
  
  // If it's already a non-IPFS URL (like data: or blob:), return as-is
  if (!oldUrl.includes('ipfs') && !oldUrl.includes('Qm')) {
    return oldUrl;
  }
  
  // Extract IPFS hash from the old URL
  const ipfsHash = extractIPFSHash(oldUrl);
  
  if (ipfsHash) {
    // Generate new URL using our improved gateway configuration
    return getIPFSUrl(ipfsHash);
  }
  
  // If no IPFS hash found, return original URL
  return oldUrl;
};

/**
 * Update NFT metadata object to use improved IPFS URLs
 */
export const updateNFTMetadataIPFS = (metadata: any): any => {
  if (!metadata || typeof metadata !== 'object') return metadata;
  
  const updatedMetadata = { ...metadata };
  
  // Update image URL if it exists
  if (updatedMetadata.image) {
    const oldImage = updatedMetadata.image;
    updatedMetadata.image = updateIPFSUrl(oldImage);
    
    if (oldImage !== updatedMetadata.image) {
      console.log(`🔄 Updated image URL: ${oldImage} -> ${updatedMetadata.image}`);
    }
  }
  
  // Update animation_url if it exists
  if (updatedMetadata.animation_url) {
    const oldAnimation = updatedMetadata.animation_url;
    updatedMetadata.animation_url = updateIPFSUrl(oldAnimation);
    
    if (oldAnimation !== updatedMetadata.animation_url) {
      console.log(`🔄 Updated animation URL: ${oldAnimation} -> ${updatedMetadata.animation_url}`);
    }
  }
  
  // Update any IPFS URLs in attributes
  if (updatedMetadata.attributes && Array.isArray(updatedMetadata.attributes)) {
    updatedMetadata.attributes = updatedMetadata.attributes.map((attr: any) => {
      if (attr.value && typeof attr.value === 'string' && (attr.value.includes('ipfs') || attr.value.includes('Qm'))) {
        const oldValue = attr.value;
        const newValue = updateIPFSUrl(oldValue);
        if (oldValue !== newValue) {
          console.log(`🔄 Updated attribute ${attr.trait_type}: ${oldValue} -> ${newValue}`);
        }
        return { ...attr, value: newValue };
      }
      return attr;
    });
  }
  
  return updatedMetadata;
};

/**
 * Test if URL is an IPFS URL
 */
export function isIPFSUrl(url: string): boolean {
  return url.includes('/ipfs/') || url.startsWith('ipfs://');
}

/**
 * Convert ipfs:// protocol to HTTP gateway URL
 */
export function normalizeIPFSUrl(url: string): string {
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return getIPFSUrl(hash);
  }
  return url;
}
