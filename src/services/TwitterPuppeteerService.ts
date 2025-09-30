export interface TwitterVerificationResult {
  success: boolean;
  message: string;
  isVerified: boolean;
  error?: string;
  details?: {
    username: string;
    tweetUrl?: string;
    keyword?: string;
    foundAt?: string;
  };
}

export interface FollowVerificationResult {
  success: boolean;
  message: string;
  isVerified: boolean;
  error?: string;
  details?: {
    username: string;
    targetUsername: string;
    foundAt: string;
  };
}

export class TwitterPuppeteerService {
  private static readonly BASE_URL = 'http://localhost:3003';
  
  /**
   * Verify if a user has retweeted a specific tweet
   */
  static async verifyRetweet(username: string, tweetUrl: string): Promise<TwitterVerificationResult> {
    try {
      console.log(`🔍 [Puppeteer] Verifying retweet for @${username} on tweet: ${tweetUrl}`);
      
      const response = await fetch(`${this.BASE_URL}/verify-retweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          tweetUrl
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ [Puppeteer] Retweet verification result:`, result);
      
      return result;
    } catch (error) {
      console.error('❌ [Puppeteer] Retweet verification error:', error);
      return {
        success: false,
        message: 'Error during retweet verification',
        isVerified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify if a user has posted a tweet with specific keywords
   */
  static async verifyTweet(username: string, keywords: string[]): Promise<TwitterVerificationResult> {
    try {
      console.log(`🔍 [Puppeteer] Verifying tweet for @${username} with keywords: ${keywords.join(', ')}`);
      
      const response = await fetch(`${this.BASE_URL}/verify-tweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          keywords
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ [Puppeteer] Tweet verification result:`, result);
      
      return result;
    } catch (error) {
      console.error('❌ [Puppeteer] Tweet verification error:', error);
      return {
        success: false,
        message: 'Error during tweet verification',
        isVerified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify if a user follows a specific account
   */
  static async verifyFollow(username: string, targetUsername: string): Promise<FollowVerificationResult> {
    try {
      console.log(`🔍 [Puppeteer] Verifying if @${username} follows @${targetUsername}`);
      
      const response = await fetch(`${this.BASE_URL}/verify-follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          targetUsername
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ [Puppeteer] Follow verification result:`, result);
      
      return result;
    } catch (error) {
      console.error('❌ [Puppeteer] Follow verification error:', error);
      return {
        success: false,
        message: 'Error during follow verification',
        isVerified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check service health
   */
  static async checkHealth(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await fetch(`${this.BASE_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ [Puppeteer] Health check error:', error);
      return {
        success: false,
        message: 'Service unavailable',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Reset browser instance (for debugging)
   */
  static async resetBrowser(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/reset-browser`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ [Puppeteer] Reset browser error:', error);
      return {
        success: false,
        message: 'Failed to reset browser'
      };
    }
  }

  /**
   * Test the service with a sample verification
   */
  static async testService(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 [Puppeteer] Testing service...');
      
      // Test health first
      const health = await this.checkHealth();
      if (!health.success) {
        return { success: false, message: 'Service health check failed', details: health };
      }

      // Test with a sample retweet verification
      const testResult = await this.verifyRetweet('elonmusk', 'https://x.com/elonmusk/status/1741073654564564992');
      
      return {
        success: true,
        message: 'Service test completed successfully',
        details: { health, testResult }
      };
    } catch (error) {
      console.error('❌ [Puppeteer] Service test error:', error);
      return {
        success: false,
        message: 'Service test failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

export default TwitterPuppeteerService;
