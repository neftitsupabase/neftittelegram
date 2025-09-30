// Test utility to check Supabase connection and help debug issues
export const testSupabaseConnection = {
  // Test basic Supabase connection
  testConnection: async () => {
    console.log('🧪 Testing Supabase Connection...');
    
    try {
      // Import supabase client
      const { supabase } = await import('@/lib/supabase');
      
      if (!supabase) {
        console.error('❌ Supabase client is null/undefined');
        return {
          success: false,
          error: 'Supabase client is null/undefined'
        };
      }
      
      console.log('✅ Supabase client imported successfully');
      
      // Check environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('📋 Environment Variables Check:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        urlLength: supabaseUrl?.length || 0,
        keyLength: supabaseKey?.length || 0
      });
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables');
        return {
          success: false,
          error: 'Missing Supabase environment variables (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)'
        };
      }
      
      // Test basic connection
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('❌ Supabase connection test failed:', error);
        return {
          success: false,
          error: `Connection test failed: ${error.message}`,
          details: error
        };
      }
      
      console.log('✅ Supabase connection successful');
      console.log('📋 Test query result:', data);
      
      return {
        success: true,
        message: 'Supabase connection test passed',
        data
      };
      
    } catch (error) {
      console.error('❌ Supabase connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  },

  // Test table access
  testTableAccess: async () => {
    console.log('🧪 Testing Table Access...');
    
    try {
      const { supabase } = await import('@/lib/supabase');
      
      if (!supabase) {
        throw new Error('Supabase client not available');
      }
      
      // Test users table access
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(1);
      
      if (usersError) {
        console.error('❌ Users table access failed:', usersError);
        return {
          success: false,
          error: `Users table access failed: ${usersError.message}`,
          details: usersError
        };
      }
      
      console.log('✅ Users table access successful');
      console.log('📋 Sample user data:', users);
      
      // Test RPC functions
      try {
        const { data: rpcTest, error: rpcError } = await supabase.rpc('check_existing_user_by_wallet', {
          wallet_address_to_check: 'test_address'
        });
        
        if (rpcError) {
          console.warn('⚠️ RPC function test failed (this might be expected):', rpcError.message);
        } else {
          console.log('✅ RPC function test successful');
        }
      } catch (rpcError) {
        console.warn('⚠️ RPC function test error (this might be expected):', rpcError);
      }
      
      return {
        success: true,
        message: 'Table access test passed',
        usersCount: users?.length || 0
      };
      
    } catch (error) {
      console.error('❌ Table access test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('🧪 Running All Supabase Connection Tests...');
    
    try {
      const results = {
        connection: await testSupabaseConnection.testConnection(),
        tableAccess: await testSupabaseConnection.testTableAccess()
      };
      
      console.log('📊 Test Results:', results);
      
      const allPassed = Object.values(results).every(result => result.success);
      
      return {
        success: allPassed,
        results,
        message: allPassed ? 'All Supabase tests passed!' : 'Some Supabase tests failed'
      };
    } catch (error) {
      console.error('❌ Supabase test suite failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Quick health check
  healthCheck: async () => {
    console.log('🏥 Supabase Health Check...');
    
    try {
      const { supabase } = await import('@/lib/supabase');
      
      if (!supabase) {
        return { status: 'critical', message: 'Supabase client not available' };
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        return { status: 'error', message: `Connection failed: ${error.message}` };
      }
      
      return { status: 'healthy', message: 'Supabase connection working' };
      
    } catch (error) {
      return { 
        status: 'critical', 
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
};

// Export for use in other components
export default testSupabaseConnection;
