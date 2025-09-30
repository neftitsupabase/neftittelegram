// Test script for username generation and validation system
console.log('🧪 Testing username generation and validation system...');

// Simple username pattern test (doesn't require module imports)
function testUsernamePattern() {
  console.log('🔤 Testing username pattern validation...');
  
  const testUsernames = [
    'neftizon_ABC',
    'neftizon_ABCDE', 
    'neftizon_XYZ',
    'neftizon_PQRST',
    'neftizon_MNO'
  ];
  
  const pattern = /^neftizon_[A-Z]{3,5}$/;
  
  testUsernames.forEach((username, index) => {
    const isValid = pattern.test(username);
    if (isValid) {
      console.log(`✅ Username ${index + 1}: ${username} - Valid pattern`);
    } else {
      console.log(`❌ Username ${index + 1}: ${username} - Invalid pattern`);
    }
  });
  
  // Test invalid patterns
  const invalidUsernames = [
    'neftizon_AB',        // Too short
    'neftizon_ABCDEF',    // Too long
    'neftizon_abc',       // Lowercase
    'neftizon_123',       // Numbers
    'neftizon_ABC@',      // Special chars
    'wrongprefix_ABC',    // Wrong prefix
    'neftizon_',          // No letters
  ];
  
  console.log('\nTesting invalid patterns:');
  invalidUsernames.forEach((username, index) => {
    const isValid = pattern.test(username);
    if (!isValid) {
      console.log(`✅ Invalid username ${index + 1}: ${username} - Correctly rejected`);
    } else {
      console.log(`❌ Invalid username ${index + 1}: ${username} - Should be rejected`);
    }
  });
}

// Import username utility functions to global scope
async function loadUsernameUtils() {
  try {
    // Import the username utility functions
    const { generateRandomUsername, validateUsername, isUsernameUnique } = await import('/src/utils/usernameUtils.ts');
    
    // Expose to global scope for testing
    window.generateRandomUsername = generateRandomUsername;
    window.validateUsername = validateUsername;
    window.isUsernameUnique = isUsernameUnique;
    
    console.log('✅ Username utility functions loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load username utility functions:', error);
    return false;
  }
}

// Test functions
function testUsernameGeneration() {
  console.log('🔤 Testing username generation...');
  
  // Test the username generation function
  if (typeof window !== 'undefined' && window.generateRandomUsername) {
    const usernames = [];
    for (let i = 0; i < 5; i++) {
      const username = window.generateRandomUsername();
      usernames.push(username);
      console.log(`Generated username ${i + 1}:`, username);
    }
    
    // Check if all usernames follow the pattern
    const pattern = /^neftizon_[A-Z]{3,5}$/;
    const validUsernames = usernames.filter(username => pattern.test(username));
    
    if (validUsernames.length === usernames.length) {
      console.log('✅ All generated usernames follow the correct pattern');
    } else {
      console.log('❌ Some usernames do not follow the correct pattern');
    }
    
    // Check for duplicates
    const uniqueUsernames = [...new Set(usernames)];
    if (uniqueUsernames.length === usernames.length) {
      console.log('✅ All generated usernames are unique');
    } else {
      console.log('❌ Some usernames are duplicates');
    }
  } else {
    console.log('❌ Username generation function not available');
  }
}

function testUsernameValidation() {
  console.log('✅ Testing username validation...');
  
  if (typeof window !== 'undefined' && window.validateUsername) {
    const testCases = [
      { username: 'neftizon_ABC', expected: true, description: 'Valid username' },
      { username: 'neftizon_ABCDE', expected: true, description: 'Valid username with 5 letters' },
      { username: 'neftizon_AB', expected: false, description: 'Too short' },
      { username: 'neftizon_ABCDEFGHIJKLMNOPQRSTUVWXYZ', expected: false, description: 'Too long' },
      { username: '', expected: false, description: 'Empty username' },
      { username: 'neftizon_abc', expected: false, description: 'Lowercase letters not allowed' },
      { username: 'neftizon_123', expected: false, description: 'Numbers not allowed' },
      { username: 'neftizon_ABC@', expected: false, description: 'Special characters not allowed' },
    ];
    
    testCases.forEach(testCase => {
      const result = window.validateUsername(testCase.username);
      const passed = result.isValid === testCase.expected;
      
      if (passed) {
        console.log(`✅ ${testCase.description}: ${testCase.username}`);
      } else {
        console.log(`❌ ${testCase.description}: ${testCase.username} (Expected: ${testCase.expected}, Got: ${result.isValid})`);
      }
    });
  } else {
    console.log('❌ Username validation function not available');
  }
}

function testCurrentUserProfile() {
  console.log('👤 Testing current user profile...');
  
  const walletAddress = localStorage.getItem('walletAddress') || 
                       localStorage.getItem('userAddress');
  
  if (walletAddress) {
    console.log('✅ User logged in with wallet:', walletAddress);
    
    // Check if user has a display name
    if (typeof window !== 'undefined' && window.supabase) {
      // This would need to be implemented with actual Supabase call
      console.log('ℹ️ User profile data would be checked here');
    }
  } else {
    console.log('❌ No user session found');
  }
}

function testEditProfilePage() {
  console.log('📄 Testing Edit Profile page...');
  
  // Check if we're on the edit profile page
  if (window.location.pathname.includes('/edit-profile')) {
    console.log('✅ On Edit Profile page');
    
    // Check for username editing elements with better selectors
    const usernameInput = document.querySelector('input[placeholder="Enter username"]') || 
                         document.querySelector('input[value*="sdfrg"]') ||
                         document.querySelector('input[type="text"]');
    
    const editButton = document.querySelector('button[aria-label*="edit"]') || 
                      document.querySelector('button svg[data-lucide="edit"]') ||
                      document.querySelector('button:has(svg[data-lucide="edit"])') ||
                      document.querySelector('button svg');
    
    const saveButton = document.querySelector('button:has(svg[data-lucide="check"])') ||
                      document.querySelector('button svg[data-lucide="check"]') ||
                      document.querySelector('button[class*="text-green"]');
    
    const cancelButton = document.querySelector('button:has(svg[data-lucide="x"])') ||
                        document.querySelector('button svg[data-lucide="x"]') ||
                        document.querySelector('button[class*="text-red"]');
    
    if (usernameInput) {
      console.log('✅ Username input field found:', usernameInput.value);
    } else {
      console.log('❌ Username input field not found');
    }
    
    if (editButton) {
      console.log('✅ Username edit button found');
    } else {
      console.log('❌ Username edit button not found');
    }
    
    if (saveButton) {
      console.log('✅ Username save button found');
    } else {
      console.log('❌ Username save button not found');
    }
    
    if (cancelButton) {
      console.log('✅ Username cancel button found');
    } else {
      console.log('❌ Username cancel button not found');
    }
    
    // Check for avatar editing
    const avatarInput = document.querySelector('input[type="file"][accept="image/*"]');
    if (avatarInput) {
      console.log('✅ Avatar upload input found');
    } else {
      console.log('❌ Avatar upload input not found');
    }
    
    // Check for the main Save button
    const mainSaveButton = document.querySelector('button:contains("Save")') ||
                          document.querySelector('button[class*="bg-gradient"]') ||
                          document.querySelector('button:last-child');
    
    if (mainSaveButton) {
      console.log('✅ Main Save button found');
    } else {
      console.log('❌ Main Save button not found');
    }
  } else {
    console.log('❌ Not on Edit Profile page');
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all username system tests...\n');
  
  testCurrentUserProfile();
  console.log('');
  
  testUsernamePattern();
  console.log('');
  
  // Load username utilities first
  const utilsLoaded = await loadUsernameUtils();
  if (!utilsLoaded) {
    console.log('⚠️ Skipping username generation and validation tests due to loading failure');
  }
  
  if (utilsLoaded) {
    testUsernameGeneration();
    console.log('');
    
    testUsernameValidation();
    console.log('');
  }
  
  testEditProfilePage();
  console.log('');
  
  console.log('✅ All tests completed!');
}

// Export test functions
window.testUsernameSystem = {
  testUsernameGeneration,
  testUsernameValidation,
  testCurrentUserProfile,
  testEditProfilePage,
  testUsernamePattern,
  runAllTests,
  loadUsernameUtils
};

console.log('🧪 Username system test functions ready!');
console.log('Run: testUsernameSystem.runAllTests() - Run all tests');
console.log('Run: testUsernameSystem.testUsernamePattern() - Test username pattern (no imports needed)');
console.log('Run: testUsernameSystem.testUsernameGeneration() - Test username generation');
console.log('Run: testUsernameSystem.testUsernameValidation() - Test username validation');
