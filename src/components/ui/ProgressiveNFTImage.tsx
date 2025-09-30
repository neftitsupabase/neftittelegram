import React, { useState, useEffect } from 'react';
import { ImageIcon, RefreshCw } from 'lucide-react';
import { IPFS_GATEWAYS, getAllIPFSUrls } from '@/config/ipfsConfig';

interface ProgressiveNFTImageProps {
  src: string;
  fallbackUrls?: string[];
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  ipfsHash?: string; // For automatic IPFS gateway fallbacks
}

const ProgressiveNFTImage: React.FC<ProgressiveNFTImageProps> = ({
  src,
  fallbackUrls = [],
  alt,
  className = "",
  onLoad,
  onError,
  ipfsHash
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error' | 'retrying'>('loading');
  const [fallbackIndex, setFallbackIndex] = useState(-1);
  const [retryCount, setRetryCount] = useState(0);

  // Generate IPFS fallback URLs if hash is provided (using centralized config)
  const ipfsFallbacks = ipfsHash ? getAllIPFSUrls(ipfsHash) : [];
  
  // All possible image URLs (primary + manual fallbacks + IPFS fallbacks)
  const allUrls = [src, ...fallbackUrls, ...ipfsFallbacks];

  const handleImageLoad = () => {
    setImageState('loaded');
    onLoad?.();
  };

  const handleImageError = () => {
    const nextIndex = fallbackIndex + 1;
    
    console.log(`❌ [ProgressiveNFTImage] Image failed for ${alt}:`, currentSrc);
    console.log(`🔍 [ProgressiveNFTImage] Available URLs (${allUrls.length}):`, allUrls);
    
    if (nextIndex < allUrls.length) {
      // Try next fallback URL immediately
      setFallbackIndex(nextIndex);
      setCurrentSrc(allUrls[nextIndex]);
      setImageState('retrying');
      console.log(`🔄 Trying fallback ${nextIndex + 1}/${allUrls.length}: ${allUrls[nextIndex]}`);
    } else {
      // All attempts failed - show error state
      setImageState('error');
      onError?.();
      console.error(`❌ All image URLs failed for: ${alt}`);
      console.error(`❌ Failed URLs:`, allUrls);
    }
  };

  // Reset when src changes
  useEffect(() => {
    console.log(`🖼️ [ProgressiveNFTImage] Loading image for ${alt}:`, {
      src,
      ipfsHash,
      totalFallbacks: allUrls.length,
      allUrls: allUrls.slice(0, 3) // Show first 3 URLs
    });
    setCurrentSrc(src);
    setImageState('loading');
    setFallbackIndex(-1);
    setRetryCount(0);
  }, [src]);

  if (imageState === 'error') {
    return (
      <div className={`bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center text-gray-400 ${className}`}>
        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-xs text-center px-2">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading indicator */}
      {(imageState === 'loading' || imageState === 'retrying') && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}
      
      {/* Actual Image */}
      <img
        src={currentSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          imageState === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
};

export default ProgressiveNFTImage;
