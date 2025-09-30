import { OffchainNFT, OnchainNFT } from './NFTLifecycleService';
import { nftLifecycleService } from './NFTLifecycleService';

export interface PaginatedNFTResult {
  nfts: (OffchainNFT | OnchainNFT)[];
  hasMore: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export interface NFTLoadingOptions {
  pageSize?: number;
  prioritizeRecent?: boolean;
  includeStaked?: boolean;
  cacheResults?: boolean;
}

interface CachedGateway {
  url: string;
  timestamp: number;
  reliability: number;
}

interface CachedNFTData {
  nfts: (OffchainNFT | OnchainNFT)[];
  timestamp: number;
  walletAddress: string;
}

class OptimizedNFTLoadingService {
  private gatewayCache = new Map<string, CachedGateway>();
  private nftDataCache = new Map<string, CachedNFTData>();
  private readonly GATEWAY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly NFT_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  private readonly DEFAULT_PAGE_SIZE = 12;

  /**
   * Load NFTs with pagination and optimization
   */
  async loadNFTsPaginated(
    walletAddress: string,
    page: number = 1,
    options: NFTLoadingOptions = {}
  ): Promise<PaginatedNFTResult> {
    const {
      pageSize = this.DEFAULT_PAGE_SIZE,
      prioritizeRecent = true,
      includeStaked = true,
      cacheResults = true
    } = options;

    console.log(`🚀 Loading NFTs page ${page} (size: ${pageSize}) for wallet: ${walletAddress.slice(0, 8)}...`);

    try {
      // Check cache first
      const cacheKey = `${walletAddress}_${includeStaked}`;
      const cachedData = this.getCachedNFTData(cacheKey);
      
      let allNFTs: (OffchainNFT | OnchainNFT)[];
      
      if (cachedData) {
        console.log(`📦 Using cached NFT data (${cachedData.length} NFTs)`);
        allNFTs = cachedData;
      } else {
        // Load fresh data from NFTLifecycleService
        console.log(`🔄 Loading fresh NFT data from services...`);
        const nftStatus = await nftLifecycleService.getNFTStatus(walletAddress);
        allNFTs = [...nftStatus.offchainNFTs, ...nftStatus.onchainNFTs];
        
        // Filter out staked NFTs if not requested
        if (!includeStaked) {
          allNFTs = allNFTs.filter(nft => !nft.isStaked);
        }

        // Cache the results
        if (cacheResults) {
          this.setCachedNFTData(cacheKey, allNFTs);
        }
      }

      // Sort NFTs for optimal loading
      if (prioritizeRecent) {
        allNFTs = this.sortNFTsByPriority(allNFTs);
      }

      // Calculate pagination
      const totalCount = allNFTs.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedNFTs = allNFTs.slice(startIndex, endIndex);
      const hasMore = endIndex < totalCount;

      // Optimize IPFS URLs for current page
      const optimizedNFTs = await this.optimizeIPFSUrls(paginatedNFTs);

      console.log(`✅ Loaded page ${page}: ${optimizedNFTs.length}/${totalCount} NFTs (hasMore: ${hasMore})`);

      return {
        nfts: optimizedNFTs,
        hasMore,
        totalCount,
        currentPage: page,
        pageSize
      };

    } catch (error) {
      console.error('❌ Error loading paginated NFTs:', error);
      throw error;
    }
  }

  /**
   * Load initial batch for immediate UI display
   */
  async loadInitialBatch(
    walletAddress: string,
    options: NFTLoadingOptions = {}
  ): Promise<PaginatedNFTResult> {
    console.log(`⚡ Loading initial NFT batch for immediate display...`);
    return this.loadNFTsPaginated(walletAddress, 1, {
      ...options,
      pageSize: options.pageSize || 6, // Smaller initial batch for speed
      prioritizeRecent: true,
      cacheResults: true
    });
  }

  /**
   * Preload next batch in background
   */
  async preloadNextBatch(
    walletAddress: string,
    currentPage: number,
    options: NFTLoadingOptions = {}
  ): Promise<void> {
    try {
      console.log(`🔮 Preloading next batch (page ${currentPage + 1}) in background...`);
      await this.loadNFTsPaginated(walletAddress, currentPage + 1, options);
      console.log(`✅ Preloaded page ${currentPage + 1} successfully`);
    } catch (error) {
      console.warn(`⚠️ Failed to preload page ${currentPage + 1}:`, error);
    }
  }

  /**
   * Sort NFTs by loading priority
   */
  private sortNFTsByPriority(nfts: (OffchainNFT | OnchainNFT)[]): (OffchainNFT | OnchainNFT)[] {
    return nfts.sort((a, b) => {
      // Priority 1: Recently claimed/staked NFTs first
      const aRecent = this.isRecentlyModified(a);
      const bRecent = this.isRecentlyModified(b);
      if (aRecent !== bRecent) return bRecent ? 1 : -1;

      // Priority 2: Onchain NFTs before offchain
      if (a.status !== b.status) {
        if (a.status === 'onchain') return -1;
        if (b.status === 'onchain') return 1;
      }

      // Priority 3: Higher rarity first
      const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
      const aRarity = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
      const bRarity = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
      if (aRarity !== bRarity) return bRarity - aRarity;

      // Priority 4: Alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Check if NFT was recently modified
   */
  private isRecentlyModified(nft: OffchainNFT | OnchainNFT): boolean {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Check claimed_at for onchain NFTs
    if ('claimed_at' in nft && nft.claimed_at) {
      return new Date(nft.claimed_at).getTime() > oneHourAgo;
    }
    
    // Check staked_at for staked NFTs
    if (nft.isStaked && 'staked_at' in nft && nft.staked_at) {
      return new Date(nft.staked_at).getTime() > oneHourAgo;
    }
    
    return false;
  }

  /**
   * Optimize IPFS URLs using cached gateways
   */
  private async optimizeIPFSUrls(nfts: (OffchainNFT | OnchainNFT)[]): Promise<(OffchainNFT | OnchainNFT)[]> {
    const optimizedNFTs = [...nfts];
    
    // Extract unique CIDs that need optimization
    const cidMap = new Map<string, number[]>();
    nfts.forEach((nft, index) => {
      if (nft.ipfs_hash) {
        if (!cidMap.has(nft.ipfs_hash)) {
          cidMap.set(nft.ipfs_hash, []);
        }
        cidMap.get(nft.ipfs_hash)!.push(index);
      }
    });

    // Optimize URLs in parallel
    const optimizationPromises = Array.from(cidMap.entries()).map(async ([cid, indices]) => {
      const optimizedUrl = await this.getOptimizedIPFSUrl(cid);
      indices.forEach(index => {
        optimizedNFTs[index] = {
          ...optimizedNFTs[index],
          image: optimizedUrl
        };
      });
    });

    await Promise.allSettled(optimizationPromises);
    return optimizedNFTs;
  }

  /**
   * Get IPFS URL with caching (Pinata primary, ipfs.io fallback)
   */
  private async getOptimizedIPFSUrl(cid: string): Promise<string> {
    // Check cache first
    const cached = this.gatewayCache.get(cid);
    if (cached && Date.now() - cached.timestamp < this.GATEWAY_CACHE_DURATION) {
      return cached.url;
    }

    // Use Pinata gateway primarily and cache result
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
    this.gatewayCache.set(cid, {
      url: ipfsUrl,
      timestamp: Date.now(),
      reliability: 1.0
    });
    return ipfsUrl;
  }

  /**
   * Cache NFT data
   */
  private setCachedNFTData(key: string, nfts: (OffchainNFT | OnchainNFT)[]): void {
    this.nftDataCache.set(key, {
      nfts,
      timestamp: Date.now(),
      walletAddress: key.split('_')[0]
    });
  }

  /**
   * Get cached NFT data if valid
   */
  private getCachedNFTData(key: string): (OffchainNFT | OnchainNFT)[] | null {
    const cached = this.nftDataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.NFT_CACHE_DURATION) {
      return cached.nfts;
    }
    return null;
  }

  /**
   * Clear cache for wallet
   */
  clearCache(walletAddress?: string): void {
    if (walletAddress) {
      // Clear specific wallet cache
      const keysToDelete = Array.from(this.nftDataCache.keys())
        .filter(key => key.startsWith(walletAddress));
      keysToDelete.forEach(key => this.nftDataCache.delete(key));
    } else {
      // Clear all cache
      this.nftDataCache.clear();
      this.gatewayCache.clear();
    }
    console.log(`🧹 Cleared NFT cache${walletAddress ? ` for ${walletAddress.slice(0, 8)}...` : ''}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    nftCacheSize: number;
    gatewayCacheSize: number;
    oldestNFTCache: number;
    oldestGatewayCache: number;
  } {
    const now = Date.now();
    const nftCacheTimes = Array.from(this.nftDataCache.values()).map(cache => cache.timestamp);
    const gatewayCacheTimes = Array.from(this.gatewayCache.values()).map(cache => cache.timestamp);

    return {
      nftCacheSize: this.nftDataCache.size,
      gatewayCacheSize: this.gatewayCache.size,
      oldestNFTCache: nftCacheTimes.length > 0 ? Math.min(...nftCacheTimes) : now,
      oldestGatewayCache: gatewayCacheTimes.length > 0 ? Math.min(...gatewayCacheTimes) : now
    };
  }
}

// Export singleton instance
export const optimizedNFTLoadingService = new OptimizedNFTLoadingService();
export default optimizedNFTLoadingService;
