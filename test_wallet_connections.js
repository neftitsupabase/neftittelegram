// Test script for Sui wallet connections in Edit Profile page
console.log('🧪 Testing Sui wallet connections in Edit Profile...');

// Test functions
function testSuiConnection() {
  console.log('🔗 Testing Sui wallet connection...');
  
  // Check if Sui wallet hooks are available
  if (typeof window !== 'undefined') {
    console.log('✅ Window object available');
    
    // Check for Sui wallet providers
    const providers = ['suiWallet', 'sui', 'suiet', 'ethosWallet', 'oneKey'];
    const availableProviders = providers.filter(provider => window[provider]);
    
    if (availableProviders.length > 0) {
      console.log('✅ Sui wallet providers found:', availableProviders);
    } else {
      console.log('❌ No Sui wallet providers found');
    }
  } else {
    console.log('❌ Window object not available');
  }
}

function testEditProfilePage() {
  console.log('📄 Testing Edit Profile page...');
  
  // Check if we're on the edit profile page
  if (window.location.pathname.includes('/edit-profile')) {
    console.log('✅ On Edit Profile page');
    
    // Check for wallet connection buttons
    const suiButton = document.querySelector('button[onclick*="sui"], button:contains("Sui")');
    
    if (suiButton) {
      console.log('✅ Sui wallet button found');
    } else {
      console.log('❌ Sui wallet button not found');
    }
  } else {
    console.log('❌ Not on Edit Profile page');
  }
}

function testUserSession() {
  console.log('👤 Testing user session...');
  
  const walletAddress = localStorage.getItem('walletAddress') || 
                       localStorage.getItem('userAddress');
  
  if (walletAddress) {
    console.log('✅ User logged in with wallet:', walletAddress);
  } else {
    console.log('❌ No user session found');
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all wallet connection tests...\n');
  
  testUserSession();
  console.log('');
  
  testSuiConnection();
  console.log('');
  
  testEditProfilePage();
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Export test functions
window.testWalletConnections = {
  testSuiConnection,
  testEditProfilePage,
  testUserSession,
  runAllTests
};

console.log('🧪 Test functions ready!');
console.log('Run: testWalletConnections.runAllTests() - Run all tests');
console.log('Run: testWalletConnections.testSuiConnection() - Test Sui wallet');
