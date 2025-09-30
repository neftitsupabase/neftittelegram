import { useEffect } from 'react';
import { useNFTContext } from '@/contexts/NFTContext';

/**
 * Hook to ensure NFTs are loaded when a page/component mounts
 * Automatically triggers loading if no NFTs are present
 */
export const useEnsureNFTsLoaded = () => {
  const { ensureNFTsLoaded, isLoading, allNFTs, isAuthenticated } = useNFTContext();

  useEffect(() => {
    if (isAuthenticated) {
      console.log('🔄 [useEnsureNFTsLoaded] Page mounted, ensuring NFTs are loaded...');
      ensureNFTsLoaded();
    }
  }, [isAuthenticated, ensureNFTsLoaded]);

  return {
    isLoading,
    hasNFTs: allNFTs.length > 0,
    nftCount: allNFTs.length
  };
};
