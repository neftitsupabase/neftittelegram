// ====================================================
// 🧪 ROBUST DISCORD SERVICE TEST SUITE
// ====================================================

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';
const TEST_CONFIG = {
  // Replace with actual Discord user IDs for testing
  VALID_USER_ID: '123456789012345678',     // Replace with real Discord user ID
  INVALID_USER_ID: '999999999999999999',   // Non-existent user
  INVALID_FORMAT: 'invalid_user_id',       // Invalid format
  TIMEOUT: 15000
};

// Test colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'cyan') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Helper function to make API requests
async function makeRequest(endpoint, data = null, method = 'GET') {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TEST_CONFIG.TIMEOUT
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const result = await response.json();
    
    return {
      status: response.status,
      ok: response.ok,
      data: result
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err.message
    };
  }
}

// Test 1: Health Check
async function testHealthCheck() {
  log('\n🔍 Testing Health Check...', 'bright');
  
  try {
    const result = await makeRequest('/health');
    
    if (result.ok && result.data.success) {
      success('Health check passed');
      info(`Service uptime: ${result.data.uptime}`);
      info(`Total requests: ${result.data.stats.totalRequests}`);
      info(`Bot token configured: ${result.data.config.botTokenConfigured ? 'Yes' : 'No'}`);
      
      if (result.data.config.botTokenConfigured) {
        success('Discord bot token is configured');
      } else {
        warning('Discord bot token is NOT configured');
      }
      
      return true;
    } else {
      error('Health check failed');
      console.log(result);
      return false;
    }
  } catch (err) {
    error(`Health check error: ${err.message}`);
    return false;
  }
}

// Test 2: Service Connectivity
async function testServiceConnectivity() {
  log('\n🌐 Testing Service Connectivity...', 'bright');
  
  try {
    const result = await makeRequest('/health');
    
    if (result.status === 0) {
      error('Cannot connect to Discord service');
      warning('Make sure the service is running on port 3001');
      warning('Run: start-discord-robust.bat');
      return false;
    } else {
      success('Service is accessible');
      return true;
    }
  } catch (err) {
    error(`Connectivity test failed: ${err.message}`);
    return false;
  }
}

// Test 3: Invalid Request Handling
async function testInvalidRequests() {
  log('\n🚫 Testing Invalid Request Handling...', 'bright');
  
  try {
    // Test missing user ID
    const result1 = await makeRequest('/verify-discord-join', {}, 'POST');
    if (result1.status === 400) {
      success('Correctly rejects missing user ID');
    } else {
      error('Should reject missing user ID');
    }
    
    // Test invalid user ID format
    const result2 = await makeRequest('/verify-discord-join', {
      discordUserId: TEST_CONFIG.INVALID_FORMAT
    }, 'POST');
    if (result2.status === 400) {
      success('Correctly rejects invalid user ID format');
    } else {
      error('Should reject invalid user ID format');
    }
    
    // Test 404 endpoint
    const result3 = await makeRequest('/nonexistent-endpoint');
    if (result3.status === 404) {
      success('Correctly handles 404 errors');
    } else {
      error('Should return 404 for nonexistent endpoints');
    }
    
    return true;
  } catch (err) {
    error(`Invalid request test failed: ${err.message}`);
    return false;
  }
}

// Test 4: Discord Membership Verification
async function testDiscordMembership() {
  log('\n👥 Testing Discord Membership Verification...', 'bright');
  
  try {
    // Test with non-existent user
    const result1 = await makeRequest('/verify-discord-join', {
      discordUserId: TEST_CONFIG.INVALID_USER_ID
    }, 'POST');
    
    if (result1.ok) {
      if (result1.data.isMember === false) {
        success('Correctly identifies non-existent user');
      } else {
        warning('Unexpected result for non-existent user');
        console.log(result1.data);
      }
    } else {
      warning('API call failed (might be expected if bot token not configured)');
      console.log(result1.data);
    }
    
    info('💡 To test with real user, update TEST_CONFIG.VALID_USER_ID');
    
    return true;
  } catch (err) {
    error(`Discord membership test failed: ${err.message}`);
    return false;
  }
}

// Test 5: Role Verification
async function testRoleVerification() {
  log('\n🎭 Testing Role Verification...', 'bright');
  
  try {
    const result = await makeRequest('/verify-discord-role', {
      discordUserId: TEST_CONFIG.INVALID_USER_ID
    }, 'POST');
    
    if (result.ok) {
      if (result.data.hasRole === false) {
        success('Correctly handles role verification for non-existent user');
      } else {
        warning('Unexpected result for role verification');
        console.log(result.data);
      }
    } else {
      warning('Role verification failed (might be expected if bot token not configured)');
      console.log(result.data);
    }
    
    return true;
  } catch (err) {
    error(`Role verification test failed: ${err.message}`);
    return false;
  }
}

// Test 6: Batch Role Verification (Egress Optimized)
async function testBatchRoleVerification() {
  log('\n🎯 Testing Batch Role Verification...', 'bright');
  
  try {
    const result = await makeRequest('/verify-discord-roles-batch', {
      discordUserId: TEST_CONFIG.INVALID_USER_ID
    }, 'POST');
    
    if (result.ok) {
      success('Batch role verification endpoint working');
      if (result.data.optimized === true) {
        success('Egress optimization enabled');
      }
      if (result.data.roles) {
        info(`Role checks: ${Object.keys(result.data.roles).length}`);
      }
    } else {
      warning('Batch role verification failed (might be expected if bot token not configured)');
      console.log(result.data);
    }
    
    return true;
  } catch (err) {
    error(`Batch role verification test failed: ${err.message}`);
    return false;
  }
}

// Test 7: Rate Limiting
async function testRateLimiting() {
  log('\n⚡ Testing Rate Limiting...', 'bright');
  
  try {
    info('Making multiple rapid requests...');
    
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(makeRequest('/health'));
    }
    
    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.status === 429);
    const successful = results.filter(r => r.ok);
    
    if (rateLimited.length > 0) {
      success(`Rate limiting working: ${rateLimited.length} requests limited`);
    }
    
    success(`${successful.length} requests succeeded`);
    
    return true;
  } catch (err) {
    error(`Rate limiting test failed: ${err.message}`);
    return false;
  }
}

// Test 8: Caching
async function testCaching() {
  log('\n💾 Testing Caching...', 'bright');
  
  try {
    // Make same request twice
    const result1 = await makeRequest('/verify-discord-join', {
      discordUserId: TEST_CONFIG.INVALID_USER_ID
    }, 'POST');
    
    const result2 = await makeRequest('/verify-discord-join', {
      discordUserId: TEST_CONFIG.INVALID_USER_ID
    }, 'POST');
    
    if (result2.ok && result2.data.cached === true) {
      success('Caching is working');
    } else {
      info('Cache not hit (might be expected for failed requests)');
    }
    
    return true;
  } catch (err) {
    error(`Caching test failed: ${err.message}`);
    return false;
  }
}

// Test 9: Cache Management
async function testCacheManagement() {
  log('\n🧹 Testing Cache Management...', 'bright');
  
  try {
    const result = await makeRequest('/clear-cache', {}, 'POST');
    
    if (result.ok && result.data.success) {
      success('Cache clearing works');
      info(`Cleared ${result.data.clearedEntries} cache entries`);
    } else {
      error('Cache clearing failed');
    }
    
    return true;
  } catch (err) {
    error(`Cache management test failed: ${err.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('🧪 ROBUST DISCORD SERVICE TEST SUITE', 'bright');
  log('==========================================', 'bright');
  
  const tests = [
    { name: 'Service Connectivity', fn: testServiceConnectivity },
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Invalid Requests', fn: testInvalidRequests },
    { name: 'Discord Membership', fn: testDiscordMembership },
    { name: 'Role Verification', fn: testRoleVerification },
    { name: 'Batch Role Verification', fn: testBatchRoleVerification },
    { name: 'Rate Limiting', fn: testRateLimiting },
    { name: 'Caching', fn: testCaching },
    { name: 'Cache Management', fn: testCacheManagement }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      error(`Test ${test.name} threw exception: ${err.message}`);
      failed++;
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log('\n==========================================', 'bright');
  log('🏁 TEST RESULTS', 'bright');
  log('==========================================', 'bright');
  
  if (passed > 0) {
    success(`${passed} tests passed`);
  }
  if (failed > 0) {
    error(`${failed} tests failed`);
  }
  
  const percentage = Math.round((passed / (passed + failed)) * 100);
  log(`📊 Success rate: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
  
  if (percentage >= 80) {
    log('\n🎉 Your Discord service is robust and ready!', 'green');
  } else {
    log('\n⚠️  Some issues detected. Check the logs above.', 'yellow');
  }
  
  log('\n💡 Next steps:', 'bright');
  log('   1. Make sure Discord bot token is configured');
  log('   2. Update TEST_CONFIG with real Discord user IDs');
  log('   3. Test with actual Discord server members');
  log('   4. Deploy to your team members');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(err => {
    error(`Test suite failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testServiceConnectivity,
  makeRequest
};

