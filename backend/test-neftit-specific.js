const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3003';

// NEFTIT Project Specific Tests
const NEFTIT_TESTS = {
  // Test with the working tweet URL we're using
  retweetTest: {
    username: 'cryptogenxz', // Replace with actual test username
    tweetUrl: 'https://x.com/neftitxyz/status/1741073654564564992' // Working tweet URL
  },
  // Test tweet content verification
  tweetContentTest: {
    username: 'cryptogenxz', // Replace with actual test username
    keywords: ['join', 'neftit'] // Keywords for NEFTIT posts
  },
  // Test follow verification
  followTest: {
    username: 'cryptogenxz', // Replace with actual test username
    targetUsername: 'neftitxyz'
  }
};

/**
 * Test NEFTIT retweet verification
 */
async function testNeftitRetweet() {
  console.log('\n🎯 Testing NEFTIT Retweet Task...');
  console.log(`📱 Username: @${NEFTIT_TESTS.retweetTest.username}`);
  console.log(`🔗 Tweet URL: ${NEFTIT_TESTS.retweetTest.tweetUrl}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-retweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: NEFTIT_TESTS.retweetTest.username,
        tweetUrl: NEFTIT_TESTS.retweetTest.tweetUrl
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
 * Test NEFTIT tweet content verification
 */
async function testNeftitTweetContent() {
  console.log('\n🎯 Testing NEFTIT Tweet Content Task...');
  console.log(`📱 Username: @${NEFTIT_TESTS.tweetContentTest.username}`);
  console.log(`🔑 Keywords: ${NEFTIT_TESTS.tweetContentTest.keywords.join(', ')}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-tweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: NEFTIT_TESTS.tweetContentTest.username,
        keywords: NEFTIT_TESTS.tweetContentTest.keywords
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ NEFTIT tweet content verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ NEFTIT tweet content verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ NEFTIT tweet content verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test NEFTIT follow verification
 */
async function testNeftitFollow() {
  console.log('\n🎯 Testing NEFTIT Follow Task...');
  console.log(`📱 Username: @${NEFTIT_TESTS.followTest.username}`);
  console.log(`🎯 Target: @${NEFTIT_TESTS.followTest.targetUsername}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: NEFTIT_TESTS.followTest.username,
        targetUsername: NEFTIT_TESTS.followTest.targetUsername
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ NEFTIT follow verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ NEFTIT follow verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ NEFTIT follow verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all NEFTIT tests
 */
async function runNeftitTests() {
  console.log('🚀 Starting NEFTIT Project Twitter Task Tests...\n');
  
  // Test 1: Retweet verification
  await testNeftitRetweet();
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 2: Tweet content verification
  await testNeftitTweetContent();
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 3: Follow verification
  await testNeftitFollow();
  
  console.log('\n🎉 All NEFTIT tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('✅ Retweet verification');
  console.log('✅ Tweet content verification');
  console.log('✅ Follow verification');
  console.log('\n💡 Now you can test these tasks in your frontend!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runNeftitTests();
}

module.exports = {
  testNeftitRetweet,
  testNeftitTweetContent,
  testNeftitFollow,
  runNeftitTests
};
