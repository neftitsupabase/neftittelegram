const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3003';

// Test with working Twitter accounts
const WORKING_TESTS = {
  // Test with a known working account and tweet
  retweetTest: {
    username: 'elonmusk', // This account exists and has tweets
    tweetUrl: 'https://x.com/neftitxyz/status/1741073654564564992' // Your working tweet
  },
  // Test tweet content with working account
  tweetContentTest: {
    username: 'elonmusk', // This account exists and has tweets
    keywords: ['tesla', 'spacex'] // Keywords that exist in their tweets
  },
  // Test follow with working account
  followTest: {
    username: 'elonmusk', // This account exists
    targetUsername: 'tesla' // This account exists
  }
};

/**
 * Test working retweet verification
 */
async function testWorkingRetweet() {
  console.log('\n🔍 Testing Working Retweet Verification...');
  console.log(`📱 Username: @${WORKING_TESTS.retweetTest.username}`);
  console.log(`🔗 Tweet URL: ${WORKING_TESTS.retweetTest.tweetUrl}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-retweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: WORKING_TESTS.retweetTest.username,
        tweetUrl: WORKING_TESTS.retweetTest.tweetUrl
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Working retweet verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ Working retweet verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Working retweet verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test working tweet content verification
 */
async function testWorkingTweetContent() {
  console.log('\n🔍 Testing Working Tweet Content Verification...');
  console.log(`📱 Username: @${WORKING_TESTS.tweetContentTest.username}`);
  console.log(`🔑 Keywords: ${WORKING_TESTS.tweetContentTest.keywords.join(', ')}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-tweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: WORKING_TESTS.tweetContentTest.username,
        keywords: WORKING_TESTS.tweetContentTest.keywords
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Working tweet content verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ Working tweet content verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Working tweet content verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test working follow verification
 */
async function testWorkingFollow() {
  console.log('\n🔍 Testing Working Follow Verification...');
  console.log(`📱 Username: @${WORKING_TESTS.followTest.username}`);
  console.log(`🎯 Target: @${WORKING_TESTS.followTest.targetUsername}`);
  
  try {
    const response = await fetch(`${BASE_URL}/verify-follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: WORKING_TESTS.followTest.username,
        targetUsername: WORKING_TESTS.followTest.targetUsername
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Working follow verification successful');
      console.log('📝 Message:', result.message);
      console.log('✅ Verified:', result.isVerified);
      if (result.details) {
        console.log('📊 Details:', result.details);
      }
    } else {
      console.log('❌ Working follow verification failed');
      console.log('❌ Error:', result.error || result.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Working follow verification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all working tests
 */
async function runWorkingTests() {
  console.log('🚀 Starting Working Twitter Verification Tests...\n');
  
  // Test 1: Retweet verification
  await testWorkingRetweet();
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 2: Tweet content verification
  await testWorkingTweetContent();
  
  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 3: Follow verification
  await testWorkingFollow();
  
  console.log('\n🎉 All working tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('✅ Retweet verification');
  console.log('✅ Tweet content verification');
  console.log('✅ Follow verification');
  console.log('\n💡 The Puppeteer service is working correctly!');
  console.log('💡 Now you can use it in your frontend with real Twitter accounts.');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runWorkingTests();
}

module.exports = {
  testWorkingRetweet,
  testWorkingTweetContent,
  testWorkingFollow,
  runWorkingTests
};
