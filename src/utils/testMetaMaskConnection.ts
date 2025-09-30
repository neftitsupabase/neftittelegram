// Test script for MetaMask connection and database sync
export const testMetaMaskConnection = {
  // Test the complete MetaMask connection flow
  testMetaMaskFlow: async () => {
    console.log('🧪 Testing MetaMask Connection Flow...');
    
    try {
      // Step 1: Check if MetaMask is available
      if (!window.ethereum || !window.ethereum.isMetaMask) {
        console.error('❌ MetaMask is not installed');
        return {
          success: false,
          error: 'MetaMask is not installed'
        };
      }
      
      console.log('✅ MetaMask is available');
      
      // Step 2: Check current connection status
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      console.log('📋 Current accounts:', accounts);
      
      if (accounts.length > 0) {
        console.log('✅ MetaMask is already connected with account:', accounts[0]);
        return {
          success: true,
          message: 'MetaMask is already connected',
          account: accounts[0]
        };
      }
      
      // Step 3: Request account access
      console.log('📋 Requesting account access...');
      const newAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('✅ Account access granted:', newAccounts);
      
      return {
        success: true,
        message: 'MetaMask connection successful',
        account: newAccounts[0]
      };
      
    } catch (error) {
      console.error('❌ MetaMask connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Test database operations
  testDatabaseOperations: async () => {
    console.log('🧪 Testing Database Operations...');
    
    try {
      // Import supabase client
      const { supabase } = await import('@/lib/supabase');
      
      if (!supabase) {
        throw new Error('Supabase client not available');
      }
      
      // Test basic connection
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }
      
      console.log('✅ Database connection successful');
      
      // Test table structure
      const { data: tableInfo, error: tableError } = await supabase
        .from('users')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.warn('⚠️ Could not inspect table structure:', tableError.message);
      } else {
        console.log('✅ Table structure accessible');
        if (tableInfo && tableInfo.length > 0) {
          console.log('📋 Sample user columns:', Object.keys(tableInfo[0]));
        }
      }
      
      return {
        success: true,
        message: 'Database operations test completed'
      };
      
    } catch (error) {
      console.error('❌ Database operations test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Test the complete authentication flow
  testCompleteAuthentication: async () => {
    console.log('🧪 Testing Complete Authentication Flow...');
    
    try {
      // Step 1: Test MetaMask connection
      const connectionTest = await testMetaMaskConnection.testMetaMaskFlow();
      if (!connectionTest.success) {
        throw new Error(`MetaMask connection failed: ${connectionTest.error}`);
      }
      
      console.log('✅ MetaMask connection test passed');
      
      // Step 2: Test database operations
      const dbTest = await testMetaMaskConnection.testDatabaseOperations();
      if (!dbTest.success) {
        throw new Error(`Database test failed: ${dbTest.error}`);
      }
      
      console.log('✅ Database operations test passed');
      
      // Step 3: Test user creation (if not already exists)
      const walletAddress = connectionTest.account;
      console.log('📋 Testing user creation for wallet:', walletAddress);
      
      const { supabase } = await import('@/lib/supabase');
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .filter('wallet_address', 'eq', walletAddress)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('⚠️ Error checking user existence:', checkError.message);
      }
      
      if (existingUser) {
        console.log('✅ User already exists:', existingUser.wallet_address);
      } else {
        console.log('📋 User does not exist, would create new user');
      }
      
      return {
        success: true,
        message: 'Complete authentication flow test passed',
        walletAddress,
        userExists: !!existingUser
      };
      
    } catch (error) {
      console.error('❌ Complete authentication test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('🧪 Running All MetaMask Connection Tests...');
    
    try {
      const results = {
        metaMaskFlow: await testMetaMaskConnection.testMetaMaskFlow(),
        databaseOperations: await testMetaMaskConnection.testDatabaseOperations(),
        completeAuthentication: await testMetaMaskConnection.testCompleteAuthentication()
      };
      
      console.log('📊 Test Results:', results);
      
      const allPassed = Object.values(results).every(result => result.success);
      
      return {
        success: allPassed,
        results,
        message: allPassed ? 'All MetaMask tests passed!' : 'Some MetaMask tests failed'
      };
    } catch (error) {
      console.error('❌ MetaMask test suite failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

// Export for use in other components
export default testMetaMaskConnection;
