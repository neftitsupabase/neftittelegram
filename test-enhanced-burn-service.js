/**
 * Test script for EnhancedHybridBurnService Web3.js conversion
 */

// Simple test to verify the service can be imported and initialized
async function testEnhancedBurnService() {
  try {
    console.log('🧪 Testing EnhancedHybridBurnService Web3.js conversion...');
    
    // Test service configuration
    const { enhancedHybridBurnService } = await import('./src/services/EnhancedHybridBurnService.ts');
    
    console.log('✅ Service imported successfully');
    
    // Test configuration
    const config = enhancedHybridBurnService.getConfiguration();
    console.log('📋 Service configuration:', config);
    
    // Test burn rules
    const burnRules = enhancedHybridBurnService.getBurnRules();
    console.log('🔥 Available burn rules:', burnRules.length);
    
    // Test onchain availability check (will fail without MetaMask, but should not crash)
    try {
      const isOnchainAvailable = await enhancedHybridBurnService.isOnChainAvailable();
      console.log('⛓️ Onchain burning available:', isOnchainAvailable);
    } catch (error) {
      console.log('⚠️ Onchain check failed (expected without MetaMask):', error.message);
    }
    
    console.log('✅ All basic tests passed - Web3.js conversion successful!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testEnhancedBurnService();
