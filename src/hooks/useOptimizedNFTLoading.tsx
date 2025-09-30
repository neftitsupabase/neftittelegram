import { useState, useEffect, useCallback, useRef } from 'react';
import { OffchainNFT, OnchainNFT } from '../services/NFTLifecycleService';
import { optimizedNFTLoadingService, PaginatedNFTResult, NFTLoadingOptions } from '../services/OptimizedNFTLoadingService';

export interface UseOptimizedNFTLoadingOptions extends NFTLoadingOptions {
  autoLoadMore?: boolean;
  preloadNext?: boolean;
}

export interface OptimizedNFTLoadingState {
  nfts: (OffchainNFT | OnchainNFT)[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  currentPage: number;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  clearCache: () => void;
}

export const useOptimizedNFTLoading = (
  walletAddress: string | null,
  options: UseOptimizedNFTLoadingOptions = {}
): OptimizedNFTLoadingState => {
  const {
    pageSize = 12,
    autoLoadMore = false,
    preloadNext = true,
    prioritizeRecent = true,
    includeStaked = true,
    cacheResults = true
  } = options;

  const [nfts, setNfts] = useState<(OffchainNFT | OnchainNFT)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const preloadingRef = useRef(false);

  const loadOptions: NFTLoadingOptions = {
    pageSize,
    prioritizeRecent,
    includeStaked,
    cacheResults
  };

  /**
   * Load initial batch of NFTs
   */
  const loadInitial = useCallback(async () => {
    if (!walletAddress || loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🚀 Loading initial NFT batch for ${walletAddress.slice(0, 8)}...`);
      
      const result: PaginatedNFTResult = await optimizedNFTLoadingService.loadInitialBatch(
        walletAddress,
        { ...loadOptions, pageSize: Math.min(pageSize, 6) } // Smaller initial batch
      );

      setNfts(result.nfts);
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
      setCurrentPage(result.currentPage);

      console.log(`✅ Initial batch loaded: ${result.nfts.length}/${result.totalCount} NFTs`);

      // Preload next batch if enabled and there's more data
      if (preloadNext && result.hasMore && !preloadingRef.current) {
        preloadingRef.current = true;
        optimizedNFTLoadingService.preloadNextBatch(walletAddress, result.currentPage, loadOptions)
          .finally(() => {
            preloadingRef.current = false;
          });
      }

    } catch (err) {
      console.error('❌ Error loading initial NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load NFTs');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [walletAddress, pageSize, prioritizeRecent, includeStaked, cacheResults, preloadNext]);

  /**
   * Load more NFTs (next page)
   */
  const loadMore = useCallback(async () => {
    if (!walletAddress || !hasMore || isLoadingMore || loadingRef.current) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const nextPage = currentPage + 1;
      console.log(`📄 Loading more NFTs (page ${nextPage})...`);

      const result: PaginatedNFTResult = await optimizedNFTLoadingService.loadNFTsPaginated(
        walletAddress,
        nextPage,
        loadOptions
      );

      setNfts(prevNfts => [...prevNfts, ...result.nfts]);
      setHasMore(result.hasMore);
      setCurrentPage(result.currentPage);

      console.log(`✅ Loaded page ${nextPage}: +${result.nfts.length} NFTs (total: ${nfts.length + result.nfts.length})`);

      // Preload next batch if enabled
      if (preloadNext && result.hasMore && !preloadingRef.current) {
        preloadingRef.current = true;
        optimizedNFTLoadingService.preloadNextBatch(walletAddress, result.currentPage, loadOptions)
          .finally(() => {
            preloadingRef.current = false;
          });
      }

    } catch (err) {
      console.error('❌ Error loading more NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more NFTs');
    } finally {
      setIsLoadingMore(false);
    }
  }, [walletAddress, hasMore, isLoadingMore, currentPage, nfts.length, loadOptions, preloadNext]);

  /**
   * Refresh NFT data (clear cache and reload)
   */
  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    console.log(`🔄 Refreshing NFT data for ${walletAddress.slice(0, 8)}...`);
    
    // Clear cache and reset state
    optimizedNFTLoadingService.clearCache(walletAddress);
    setNfts([]);
    setCurrentPage(1);
    setHasMore(false);
    setTotalCount(0);
    setError(null);

    // Reload initial data
    await loadInitial();
  }, [walletAddress, loadInitial]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    if (walletAddress) {
      optimizedNFTLoadingService.clearCache(walletAddress);
      console.log(`🧹 Cleared cache for ${walletAddress.slice(0, 8)}...`);
    }
  }, [walletAddress]);

  /**
   * Auto-load more when reaching end (if enabled)
   */
  useEffect(() => {
    if (autoLoadMore && hasMore && !isLoadingMore && nfts.length > 0) {
      // Auto-load when we have less than one page worth of data remaining
      const remainingSlots = totalCount - nfts.length;
      if (remainingSlots <= pageSize) {
        console.log(`🔄 Auto-loading more NFTs (${remainingSlots} remaining)...`);
        loadMore();
      }
    }
  }, [autoLoadMore, hasMore, isLoadingMore, nfts.length, totalCount, pageSize, loadMore]);

  /**
   * Load initial data when wallet changes
   */
  useEffect(() => {
    if (walletAddress) {
      loadInitial();
    } else {
      // Reset state when no wallet
      setNfts([]);
      setIsLoading(false);
      setIsLoadingMore(false);
      setHasMore(false);
      setTotalCount(0);
      setCurrentPage(1);
      setError(null);
    }
  }, [walletAddress, loadInitial]);

  return {
    nfts,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    currentPage,
    error,
    loadMore,
    refresh,
    clearCache
  };
};

/**
 * Hook for infinite scroll behavior
 */
export const useInfiniteNFTScroll = (
  walletAddress: string | null,
  options: UseOptimizedNFTLoadingOptions = {}
) => {
  const nftState = useOptimizedNFTLoading(walletAddress, {
    ...options,
    autoLoadMore: false // Manual control for infinite scroll
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  /**
   * Intersection observer callback
   */
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && nftState.hasMore && !nftState.isLoadingMore) {
      console.log(`👁️ Intersection detected - loading more NFTs...`);
      nftState.loadMore();
    }
  }, [nftState.hasMore, nftState.isLoadingMore, nftState.loadMore]);

  /**
   * Set up intersection observer
   */
  const setLoadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (node && nftState.hasMore) {
      observerRef.current = new IntersectionObserver(handleIntersection, {
        threshold: 0.1,
        rootMargin: '100px'
      });
      observerRef.current.observe(node);
      loadMoreRef.current = node;
    }
  }, [nftState.hasMore, handleIntersection]);

  /**
   * Cleanup observer
   */
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    ...nftState,
    setLoadMoreRef
  };
};

export default useOptimizedNFTLoading;
