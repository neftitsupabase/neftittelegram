// Test script to verify UUID creation issue is fixed
console.log('🧪 Testing UUID creation fix for Sui and WalletConnect...');

// Test functions
async function testUUIDConsistency() {
  console.log('🔍 Testing UUID consistency...');
  
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
  
  try {
    // Get user data before any linking
    const { data: userBefore, error: errorBefore } = await supabase
      .from('users')
      .select('id, wallet_address, display_name, linked_wallet_addresses')
      .eq('wallet_address', currentWalletAddress)
      .single();
    
    if (errorBefore) {
      console.error('❌ Error fetching user data before:', errorBefore);
      return;
    }
    
    console.log('✅ User before linking:', {
      id: userBefore.id,
      wallet_address: userBefore.wallet_address,
      display_name: userBefore.display_name,
      linked_wallets_count: userBefore.linked_wallet_addresses?.length || 0
    });
    
    // Test linking a mock Sui wallet
    const mockSuiAddress = '0x' + Math.random().toString(36).substring(2, 42);
    console.log('🔗 Testing Sui wallet linking with address:', mockSuiAddress);
    
    const { data: linkResult, error: linkError } = await supabase.rpc('link_additional_provider', {
      target_user_address: currentWalletAddress,
      new_address: mockSuiAddress,
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
      console.log('✅ No new UUID created - wallet linked to existing account');
    } else {
      console.log('❌ UUID changed! Before:', userBefore.id, 'After:', userAfter.id);
      console.log('❌ This indicates the fix is not working');
    }
    
    // Check if the new wallet was actually linked
    const linkedWallets = userAfter.linked_wallet_addresses || [];
    const isLinked = linkedWallets.some(wallet => wallet.address === mockSuiAddress);
    
    if (isLinked) {
      console.log('✅ Mock Sui wallet successfully linked to existing user!');
    } else {
      console.log('❌ Mock Sui wallet not found in linked wallets');
    }
    
  } catch (error) {
    console.error('❌ UUID consistency test failed:', error);
  }
}

async function testLinkingModeFlag() {
  console.log('🏷️ Testing linking mode flag...');
  
  // Test setting the flag
  localStorage.setItem('edit_profile_linking_mode', 'true');
  localStorage.setItem('linking_wallet_type', 'sui');
  
  const isLinkingMode = localStorage.getItem('edit_profile_linking_mode') === 'true';
  const linkingWalletType = localStorage.getItem('linking_wallet_type');
  
  console.log('Flag status:', {
    isLinkingMode,
    linkingWalletType
  });
  
  if (isLinkingMode && linkingWalletType === 'sui') {
    console.log('✅ Linking mode flag set correctly');
  } else {
    console.log('❌ Linking mode flag not set correctly');
  }
  
  // Test cleaning up the flag
  localStorage.removeItem('edit_profile_linking_mode');
  localStorage.removeItem('linking_wallet_type');
  
  const isLinkingModeAfter = localStorage.getItem('edit_profile_linking_mode') === 'true';
  const linkingWalletTypeAfter = localStorage.getItem('linking_wallet_type');
  
  if (!isLinkingModeAfter && !linkingWalletTypeAfter) {
    console.log('✅ Linking mode flag cleaned up correctly');
  } else {
    console.log('❌ Linking mode flag not cleaned up correctly');
  }
}

function checkCurrentSession() {
  console.log('👤 Checking current session...');
  
  const walletAddress = localStorage.getItem('walletAddress') || 
                       localStorage.getItem('userAddress');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const walletType = localStorage.getItem('walletType');
  const isLinkingMode = localStorage.getItem('edit_profile_linking_mode') === 'true';
  const linkingWalletType = localStorage.getItem('linking_wallet_type');
  
  console.log('Current session:', {
    walletAddress,
    isAuthenticated,
    walletType,
    isLinkingMode,
    linkingWalletType
  });
  
  return { walletAddress, isAuthenticated, walletType, isLinkingMode, linkingWalletType };
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all UUID fix tests...\n');
  
  checkCurrentSession();
  console.log('');
  
  await testLinkingModeFlag();
  console.log('');
  
  await testUUIDConsistency();
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Export test functions
window.testUUIDFix = {
  testUUIDConsistency,
  testLinkingModeFlag,
  checkCurrentSession,
  runAllTests
};

console.log('🧪 UUID fix test functions ready!');
console.log('Run: testUUIDFix.runAllTests() - Run all tests');
console.log('Run: testUUIDFix.testUUIDConsistency() - Test UUID consistency');
console.log('Run: testUUIDFix.testLinkingModeFlag() - Test linking mode flag');
