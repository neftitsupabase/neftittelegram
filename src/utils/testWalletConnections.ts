// Test utility for wallet connections
export const testWalletConnections = {
  // Test MetaMask connection
  testMetaMask: async () => {
    try {
      if (!window.ethereum || !window.ethereum.isMetaMask) {
        console.log('❌ MetaMask not installed');
        return { success: false, error: 'MetaMask not installed' };
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = accounts[0];
      
      if (!walletAddress) {
        return { success: false, error: 'No account selected' };
      }

      console.log('✅ MetaMask connected:', walletAddress);
      return { success: true, address: walletAddress };
    } catch (error) {
      console.error('❌ MetaMask test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Test Phantom connection
  testPhantom: async () => {
    try {
      const provider = window.solana;
      if (!provider || !provider.isPhantom) {
        console.log('❌ Phantom not installed');
        return { success: false, error: 'Phantom not installed' };
      }

      const resp = await provider.connect();
      const walletAddress = resp.publicKey?.toString();
      
      if (!walletAddress) {
        return { success: false, error: 'No account selected' };
      }

      console.log('✅ Phantom connected:', walletAddress);
      return { success: true, address: walletAddress };
    } catch (error) {
      console.error('❌ Phantom test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Test wallet connection flow
  testConnectionFlow: async (walletType: 'metamask' | 'phantom') => {
    console.log(`🧪 Testing ${walletType} connection flow...`);
    
    if (walletType === 'metamask') {
      return await testWalletConnections.testMetaMask();
    } else if (walletType === 'phantom') {
      return await testWalletConnections.testPhantom();
    } else {
      return { success: false, error: 'Unsupported wallet type' };
    }
  }
};

