import React from 'react';
import { useNFTContext } from '@/contexts/NFTContext';
import { useAuthState } from '@/hooks/useAuthState';

/**
 * Debug component to test NFT count syncing
 * Add this temporarily to any page to test the sync functionality
 */
export const NFTCountDebug: React.FC = () => {
  const { 
    allNFTs, 
    offchainNFTs, 
    onchainNFTs, 
    syncNFTCountsToBackend 
  } = useNFTContext();
  
  const { walletAddress } = useAuthState();

  const handleManualSync = async () => {
    console.log('🧪 [DEBUG] Manual sync triggered');
    try {
      await syncNFTCountsToBackend();
      console.log('🧪 [DEBUG] Manual sync completed');
    } catch (error) {
      console.error('🧪 [DEBUG] Manual sync failed:', error);
    }
  };

  const checkDatabase = async () => {
    console.log('🧪 [DEBUG] Checking database directly...');
    
    // You can add a direct database check here if needed
    const response = await fetch('/api/debug/nft-counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🧪 [DEBUG] Database counts:', data);
    } else {
      console.error('🧪 [DEBUG] Failed to check database');
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: '#f0f0f0', 
      padding: '15px', 
      border: '1px solid #ccc',
      borderRadius: '8px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <h4>🧪 NFT Count Debug</h4>
      
      <div>
        <strong>Wallet:</strong> {walletAddress?.slice(0, 8)}...
      </div>
      
      <div>
        <strong>Total NFTs:</strong> {allNFTs.length}
      </div>
      
      <div>
        <strong>Offchain:</strong> {offchainNFTs.length}
      </div>
      
      <div>
        <strong>Onchain:</strong> {onchainNFTs.length}
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={handleManualSync}
          style={{ 
            padding: '5px 10px', 
            marginRight: '5px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          🔄 Sync to DB
        </button>
        
        <button 
          onClick={checkDatabase}
          style={{ 
            padding: '5px 10px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          🔍 Check DB
        </button>
      </div>
      
      <div style={{ marginTop: '5px', fontSize: '10px', color: '#666' }}>
        Check console for detailed logs
      </div>
    </div>
  );
};

export default NFTCountDebug;
