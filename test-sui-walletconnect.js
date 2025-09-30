// Test script for Sui and WalletConnect connections
// Run this in the browser console on the Edit Profile page

console.log('🧪 Testing Sui and WalletConnect connections...');

// Function to test wallet connections
async function testWalletConnections() {
  try {
    // Check if we're on the right page
    if (!window.location.pathname.includes('/edit-profile')) {
      console.log('❌ Please run this test on the Edit Profile page');
      return;
    }

    // Check if user is logged in
    const walletAddress = localStorage.getItem('walletAddress');
    if (!walletAddress) {
      console.log('❌ No wallet address found. Please log in first.');
      return;
    }

    console.log('✅ User logged in with wallet:', walletAddress);

    // Test Sui wallet connection
    console.log('\n🔗 Testing Sui wallet connection...');
    try {
      // Simulate clicking the Sui connect button
      const suiButton = document.querySelector('button[onclick*="sui"]') || 
                       document.querySelector('button:contains("Sui Wallet")');
      
      if (suiButton) {
        console.log('✅ Found Sui wallet button, clicking...');
        suiButton.click();
        
        // Wait for connection process
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Sui wallet connection test completed');
      } else {
        console.log('⚠️ Sui wallet button not found');
      }
    } catch (error) {
      console.log('❌ Sui wallet connection test failed:', error.message);
    }

    // Test WalletConnect connection
    console.log('\n🔗 Testing WalletConnect connection...');
    try {
      // Simulate clicking the WalletConnect button
      const wcButton = document.querySelector('button[onclick*="walletconnect"]') || 
                      document.querySelector('button:contains("WalletConnect")');
      
      if (wcButton) {
        console.log('✅ Found WalletConnect button, clicking...');
        wcButton.click();
        
        // Wait for connection process
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ WalletConnect connection test completed');
      } else {
        console.log('⚠️ WalletConnect button not found');
      }
    } catch (error) {
      console.log('❌ WalletConnect connection test failed:', error.message);
    }

    // Check current connections
    console.log('\n📊 Checking current connections...');
    try {
      const { data: connections } = await supabase.rpc('get_user_connections', {
        user_wallet_address: walletAddress
      });
      
      if (connections && connections.length > 0) {
        const userConnections = connections[0];
        console.log('✅ Current connections:', {
          linked_wallets: userConnections.linked_wallet_addresses?.length || 0,
          linked_socials: userConnections.linked_social_accounts?.length || 0
        });
        
        if (userConnections.linked_wallet_addresses) {
          console.log('🔗 Linked wallets:', userConnections.linked_wallet_addresses);
        }
      } else {
        console.log('⚠️ No connections found');
      }
    } catch (error) {
      console.log('❌ Error checking connections:', error.message);
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Function to manually test specific wallet connection
async function testSpecificWallet(walletType) {
  try {
    console.log(`🧪 Testing ${walletType} connection...`);
    
    const walletAddress = localStorage.getItem('walletAddress');
    if (!walletAddress) {
      console.log('❌ No wallet address found. Please log in first.');
      return;
    }

    // Create a mock wallet address for testing
    const mockAddress = `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`🔗 Mock ${walletType} address:`, mockAddress);

    // Test the connection using the RPC function directly
    const { data, error } = await supabase.rpc('link_additional_provider', {
      target_user_address: walletAddress,
      new_address: mockAddress,
      new_provider: walletType,
      link_method: 'wallet'
    });

    if (error) {
      console.log(`❌ ${walletType} connection failed:`, error);
    } else {
      console.log(`✅ ${walletType} connection successful:`, data);
    }

  } catch (error) {
    console.log(`❌ ${walletType} test failed:`, error.message);
  }
}

// Make functions available globally
window.testWalletConnections = testWalletConnections;
window.testSpecificWallet = testSpecificWallet;

console.log('🚀 Test functions ready!');
console.log('Run: testWalletConnections() - Test both wallets');
console.log('Run: testSpecificWallet("sui") - Test Sui wallet');
console.log('Run: testSpecificWallet("walletconnect") - Test WalletConnect');
