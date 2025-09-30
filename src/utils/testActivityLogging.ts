import activityTrackingService from '../services/ActivityTrackingService';

/**
 * Test function to verify activity logging is working
 * This can be called from the browser console to test activity logging
 */
export async function testActivityLogging(walletAddress: string) {
  console.log('🧪 Testing activity logging for wallet:', walletAddress);
  
  try {
    // Test basic activity logging
    const activityId = await activityTrackingService.logActivity(walletAddress, {
      activityType: 'task',
      title: 'Test Activity',
      description: 'This is a test activity to verify logging is working',
      details: 'Testing activity logging functionality',
      neftReward: 10,
      xpReward: 5,
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    
    if (activityId) {
      console.log('✅ Test activity logged successfully with ID:', activityId);
      
      // Now try to fetch the activities to verify they're being stored
      const activities = await activityTrackingService.getUserActivities(walletAddress, undefined, 10, 0);
      console.log('📋 Retrieved activities:', activities);
      
      return {
        success: true,
        activityId,
        activitiesCount: activities.length,
        activities
      };
    } else {
      console.error('❌ Test activity logging failed - no activity ID returned');
      return {
        success: false,
        error: 'No activity ID returned'
      };
    }
  } catch (error) {
    console.error('❌ Test activity logging failed with error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testActivityLogging = testActivityLogging;
}
