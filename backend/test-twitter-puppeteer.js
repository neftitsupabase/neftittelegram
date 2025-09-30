const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3003';

// Test configuration
const TEST_CONFIG = {
  // Test with a known public tweet for retweet verification
  retweetTest: {
    username: 'elonmusk',
    tweetUrl: 'https://x.com/elonmusk/status/1741073654564564992'
  },
  // Test with keywords for tweet content verification
  tweetContentTest: {
    username: 'elonmusk',
    keywords: ['tesla', 'spacex']
  },
  // Test follow verification
  followTest: {
    username: 'elonmusk',
    targetUsername: 'tesla'
  }
};

/**
 * Test service health
 */
async function testHealth() {
  console.log('🏥 Testing service health...');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Health check passed:', result.message);
      console.log('📊 Browser status:', result.browserStatus);
      console.log('⚙️ Configuration:', result.config);
      return true;
    } else {
      console.log('❌ Health check failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    return false;
  }
}

/**
 * Test retweet verification
 */
async function testRetweetVerification() {
  console.log('\n🔍 Testing retweet verification...');
  console.log(`📱 Username: @${TEST_CONFIG.retweetTest.username}`);
  console.log(`🔗 Tweet URL: ${TEST_CONFIG.retweetTest.tweetUrl}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-retweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: TEST_CONFIG.retweetTest.username,
        tweetUrl: TEST_CONFIG.retweetTest.tweetUrl
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Retweet verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ Retweet verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Retweet verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test tweet content verification
 */
async function testTweetContentVerification() {
  console.log('\n🔍 Testing tweet content verification...');
  console.log(`📱 Username: @${TEST_CONFIG.tweetContentTest.username}`);
  console.log(`🔑 Keywords: ${TEST_CONFIG.tweetContentTest.keywords.join(', ')}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-tweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: TEST_CONFIG.tweetContentTest.username,
        keywords: TEST_CONFIG.tweetContentTest.keywords
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Tweet content verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ Tweet content verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Tweet content verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test follow verification
 */
async function testFollowVerification() {
  console.log('\n🔍 Testing follow verification...');
  console.log(`📱 Username: @${TEST_CONFIG.followTest.username}`);
  console.log(`🎯 Target: @${TEST_CONFIG.followTest.targetUsername}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: TEST_CONFIG.followTest.username,
        targetUsername: TEST_CONFIG.followTest.targetUsername
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Follow verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ Follow verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Follow verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test browser reset functionality
 */
async function testBrowserReset() {
  console.log('\n🔄 Testing browser reset...');
  
  try {
    const response = await fetch(`${BASE_URL}/reset-browser`, {
      method: 'POST'
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Browser reset successful:', result.message);
    } else {
      console.log('❌ Browser reset failed:', result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Browser reset error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test with your specific NEFTIT project requirements
 */
async function testNeftitRequirements() {
  console.log('\n🎯 Testing NEFTIT project requirements...');
  
  // Test retweet verification for your specific tweet
  const neftitRetweetTest = {
    username: 'cryptogenxz', // Replace with actual test username
    tweetUrl: 'https://x.com/neftitxyz/status/1937138311593656686'
  };
  
  console.log(`📱 Testing retweet for @${neftitRetweetTest.username}`);
  console.log(`🔗 Tweet URL: ${neftitRetweetTest.tweetUrl}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-retweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: neftitRetweetTest.username,
        tweetUrl: neftitRetweetTest.tweetUrl
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ NEFTIT retweet verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ NEFTIT retweet verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ NEFTIT retweet verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Twitter Puppeteer verification service tests...\n');
  
  // Test 1: Health check
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n❌ Service is not healthy. Please start the service first.');
    console.log('💡 Run: npm install && npm start');
    return;
  }
  
  // Wait a bit for browser initialization
  console.log('\n⏳ Waiting for browser initialization...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 2: Retweet verification
  await testRetweetVerification();
  
  // Wait between tests to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 3: Tweet content verification
  await testTweetContentVerification();
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 4: Follow verification
  await testFollowVerification();
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 5: NEFTIT specific requirements
  await testNeftitRequirements();
  
  // Test 6: Browser reset
  await testBrowserReset();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('✅ Health check');
  console.log('✅ Retweet verification');
  console.log('✅ Tweet content verification');
  console.log('✅ Follow verification');
  console.log('✅ NEFTIT requirements test');
  console.log('✅ Browser reset');
}

/**
 * Run specific test
 */
async function runSpecificTest(testName) {
  switch (testName) {
    case 'health':
      await testHealth();
      break;
    case 'retweet':
      await testRetweetVerification();
      break;
    case 'tweet':
      await testTweetContentVerification();
      break;
    case 'follow':
      await testFollowVerification();
      break;
    case 'neftit':
      await testNeftitRequirements();
      break;
    case 'reset':
      await testBrowserReset();
      break;
    default:
      console.log('❌ Unknown test:', testName);
      console.log('Available tests: health, retweet, tweet, follow, neftit, reset');
  }
}

// Main execution
if (require.main === module) {
  const testName = process.argv[2];
  
  if (testName) {
    console.log(`🧪 Running specific test: ${testName}`);
    runSpecificTest(testName);
  } else {
    console.log('🧪 Running all tests...');
    runAllTests();
  }
}

module.exports = {
  testHealth,
  testRetweetVerification,
  testTweetContentVerification,
  testFollowVerification,
  testBrowserReset,
  testNeftitRequirements,
  runAllTests,
  runSpecificTest
};
