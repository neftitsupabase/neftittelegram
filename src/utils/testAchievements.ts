// Test utility for debugging achievements
// Run this in browser console to test achievements functionality

import achievementsService from '../services/AchievementsService';
import { getWalletAddress } from './authUtils';

// Test function to debug achievements
export const testAchievements = async () => {
  console.log('🔍 Testing Achievements System...');
  
  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    console.error('❌ No wallet address found. Please connect wallet first.');
    return;
  }
  
  console.log(`📍 Testing for wallet: ${walletAddress}`);
  
  try {
    // 1. Initialize achievements
    console.log('🔄 Initializing achievements...');
    const initResult = await achievementsService.initializeUserAchievements(walletAddress);
    console.log('✅ Achievements initialized:', initResult);
    
    // 2. Get current achievements
    console.log('🔄 Fetching current achievements...');
    const achievements = await achievementsService.getUserAchievements(walletAddress);
    console.log('📊 Current achievements:', achievements);
    
    // 3. Check achievement stats
    console.log('🔄 Fetching achievement stats...');
    const stats = await achievementsService.getAchievementStats(walletAddress);
    console.log('📈 Achievement stats:', stats);
    
    // 4. Test updating a simple achievement (first_burn)
    console.log('🔄 Testing achievement progress update...');
    const progressResult = await achievementsService.updateAchievementProgress(walletAddress, 'first_burn', 1);
    console.log('🎯 Progress update result:', progressResult);
    
    // 5. Get achievements again to see changes
    console.log('🔄 Fetching achievements after update...');
    const updatedAchievements = await achievementsService.getUserAchievements(walletAddress);
    const firstBurnAchievement = updatedAchievements.find(a => a.achievement_key === 'first_burn');
    console.log('🔥 First burn achievement after update:', firstBurnAchievement);
    
    // 6. Check if any achievements are ready to claim
    const claimableAchievements = updatedAchievements.filter(a => 
      a.status === 'completed' && !a.claimed_at
    );
    console.log('🏆 Claimable achievements:', claimableAchievements);
    
    // 7. Test claiming if any are available
    if (claimableAchievements.length > 0) {
      const achievementToClaim = claimableAchievements[0];
      console.log(`🔄 Testing claim for: ${achievementToClaim.achievement_key}`);
      const claimResult = await achievementsService.claimAchievementReward(walletAddress, achievementToClaim.achievement_key);
      console.log('💰 Claim result:', claimResult);
    } else {
      console.log('ℹ️ No achievements ready to claim');
    }
    
    console.log('✅ Achievements test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing achievements:', error);
  }
};

// Test function to manually complete an achievement for testing
export const forceCompleteAchievement = async (achievementKey: string) => {
  console.log(`🔧 Force completing achievement: ${achievementKey}`);
  
  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    console.error('❌ No wallet address found. Please connect wallet first.');
    return;
  }
  
  try {
    // Update progress with a large number to ensure completion
    const result = await achievementsService.updateAchievementProgress(walletAddress, achievementKey, 100);
    console.log('✅ Force completion result:', result);
    
    // Get the updated achievement
    const achievements = await achievementsService.getUserAchievements(walletAddress);
    const updatedAchievement = achievements.find(a => a.achievement_key === achievementKey);
    console.log('📊 Updated achievement:', updatedAchievement);
    
  } catch (error) {
    console.error('❌ Error force completing achievement:', error);
  }
};

// Add to window for browser console access
declare global {
  interface Window {
    testAchievements: typeof testAchievements;
    forceCompleteAchievement: typeof forceCompleteAchievement;
  }
}

if (typeof window !== 'undefined') {
  window.testAchievements = testAchievements;
  window.forceCompleteAchievement = forceCompleteAchievement;
}

export default {
  testAchievements,
  forceCompleteAchievement
};
