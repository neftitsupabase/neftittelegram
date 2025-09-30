// Test script for Sui wallet linking to verify it doesn't create new UUIDs
console.log('🧪 Testing Sui wallet linking to existing user...');

// Test functions
async function testSuiLinking() {
  console.log('🔗 Testing Sui wallet linking...');
  
  // Check current user state
  const currentWalletAddress = localStorage.getItem('walletAddress') || 
                              localStorage.getItem('userAddress');
  
  if (!currentWalletAddress) {
    console.log('❌ No current user session found');
    return;
  }
  
  console.log('✅ Current user wallet address:', currentWalletAddress);
  
  // Check if supabase is available
  if (typeof supabase === 'undefined') {
    console.log('❌ Supabase not available');
    return;
  }
  
  // Test the link_additional_provider function directly
  const testWalletAddress = '0x1234567890abcdef1234567890abcdef12345678'; // Mock Sui address
  const testProvider = 'sui';
  
  console.log('🔗 Testing link_additional_provider function...');
  console.log('Target user:', currentWalletAddress);
  console.log('New wallet:', testWalletAddress);
  console.log('Provider:', testProvider);
  
  try {
    const { data, error } = await supabase.rpc('link_additional_provider', {
      target_user_address: currentWalletAddress,
      new_address: testWalletAddress,
      new_provider: testProvider,
      link_method: 'wallet'
    });
    
    if (error) {
      console.error('❌ Link function error:', error);
      return;
    }
    
    console.log('✅ Link function result:', data);
    
    // Check if the wallet was actually linked
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, linked_wallet_addresses')
      .eq('wallet_address', currentWalletAddress)
      .single();
    
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return;
    }
    
    console.log('✅ User data after linking:', userData);
    
    // Check if the new wallet is in the linked_wallet_addresses
    const linkedWallets = userData.linked_wallet_addresses || [];
    const isLinked = linkedWallets.some(wallet => wallet.address === testWalletAddress);
    
    if (isLinked) {
      console.log('✅ Sui wallet successfully linked to existing user!');
      console.log('✅ No new UUID created - wallet linked to existing account');
    } else {
      console.log('❌ Sui wallet not found in linked wallets');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testUserUUIDConsistency() {
  console.log('🔍 Testing user UUID consistency...');
  
  const currentWalletAddress = localStorage.getItem('walletAddress') || 
                              localStorage.getItem('userAddress');
  
  if (!currentWalletAddress) {
    console.log('❌ No current user session found');
    return;
  }
  
  try {
    // Get user data before linking
    const { data: userBefore, error: errorBefore } = await supabase
      .from('users')
      .select('id, wallet_address, display_name')
      .eq('wallet_address', currentWalletAddress)
      .single();
    
    if (errorBefore) {
      console.error('❌ Error fetching user data before:', errorBefore);
      return;
    }
    
    console.log('✅ User before linking:', {
      id: userBefore.id,
      wallet_address: userBefore.wallet_address,
      display_name: userBefore.display_name
    });
    
    // Simulate linking a new wallet
    const testWalletAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
    
    const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
      target_user_address: currentWalletAddress,
      new_address: testWalletAddress,
      new_provider: 'sui',
      link_method: 'wallet'
    });
    
    if (linkError) {
      console.error('❌ Link error:', linkError);
      return;
    }
    
    console.log('✅ Link result:', linkResult);
    
    // Get user data after linking
    const { data: userAfter, error: errorAfter } = await supabase
      .from('users')
      .select('id, wallet_address, display_name, linked_wallet_addresses')
      .eq('wallet_address', currentWalletAddress)
      .single();
    
    if (errorAfter) {
      console.error('❌ Error fetching user data after:', errorAfter);
      return;
    }
    
    console.log('✅ User after linking:', {
      id: userAfter.id,
      wallet_address: userAfter.wallet_address,
      display_name: userAfter.display_name,
      linked_wallets_count: userAfter.linked_wallet_addresses?.length || 0
    });
    
    // Check if UUID remained the same
    if (userBefore.id === userAfter.id) {
      console.log('✅ UUID consistency maintained! Same user ID:', userBefore.id);
    } else {
      console.log('❌ UUID changed! Before:', userBefore.id, 'After:', userAfter.id);
    }
    
  } catch (error) {
    console.error('❌ UUID consistency test failed:', error);
  }
}

function checkCurrentSession() {
  console.log('👤 Checking current session...');
  
  const walletAddress = localStorage.getItem('walletAddress') || 
                       localStorage.getItem('userAddress');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const walletType = localStorage.getItem('walletType');
  
  console.log('Current session:', {
    walletAddress,
    isAuthenticated,
    walletType
  });
  
  return { walletAddress, isAuthenticated, walletType };
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all Sui linking tests...\n');
  
  checkCurrentSession();
  console.log('');
  
  await testSuiLinking();
  console.log('');
  
  await testUserUUIDConsistency();
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Export test functions
window.testSuiLinking = {
  testSuiLinking,
  testUserUUIDConsistency,
  checkCurrentSession,
  runAllTests
};

console.log('🧪 Sui linking test functions ready!');
console.log('Run: testSuiLinking.runAllTests() - Run all tests');
console.log('Run: testSuiLinking.testSuiLinking() - Test Sui wallet linking');
console.log('Run: testSuiLinking.testUserUUIDConsistency() - Test UUID consistency');
