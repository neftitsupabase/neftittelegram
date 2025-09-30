// ==================================================
// 🚀 ROBUST TWITTER VERIFICATION SERVICE
// Frontend service for Twitter task verification
// ==================================================

export interface TwitterVerificationResult {
  success: boolean;
  hasRetweeted?: boolean;
  hasPosted?: boolean;
  retweets?: any[];
  posts?: any[];
  username: string;
  targetTweetId?: string;
  keywords?: string[];
  profileUrl?: string;
  timestamp: string;
  cached?: boolean;
  error?: string;
}

export interface BatchTwitterResult {
  success: boolean;
  username: string;
  retweet: {
    hasRetweeted: boolean;
    targetTweet: string;
    details: any;
  };
  xpost: {
    hasPosted: boolean;
    keywords: string[];
    details: any;
  };
  allTasksComplete: boolean;
  timestamp: string;
  cached?: boolean;
  optimized?: boolean;
}

class TwitterVerificationService {
  private baseUrl = 'http://localhost:3002';
  private retryCount = 3;
  private retryDelay = 1000;

  private async makeRequest<T>(
    endpoint: string,
    data: any,
    retries: number = this.retryCount
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`❌ Twitter verification error (attempt ${this.retryCount - retries + 1}):`, error);
      
      if (retries > 1) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.makeRequest<T>(endpoint, data, retries - 1);
      }
      
      throw error;
    }
  }

  // Verify retweet task
  async verifyRetweet(
    twitterUsername: string,
    targetTweetId?: string
  ): Promise<TwitterVerificationResult> {
    try {
      console.log(`🔍 Verifying retweet for @${twitterUsername}`);
      
      const result = await this.makeRequest<TwitterVerificationResult>('/verify-retweet', {
        twitterUsername,
        targetTweetId
      });

      console.log(`✅ Retweet verification result:`, result);
      return result;
    } catch (error) {
      console.error('❌ Retweet verification failed:', error);
      throw error;
    }
  }

  // Verify X post task
  async verifyTweet(
    twitterUsername: string,
    keywords?: string[]
  ): Promise<TwitterVerificationResult> {
    try {
      console.log(`🔍 Verifying X post for @${twitterUsername}`);
      
      const result = await this.makeRequest<TwitterVerificationResult>('/verify-tweet', {
        twitterUsername,
        keywords
      });

      console.log(`✅ X post verification result:`, result);
      return result;
    } catch (error) {
      console.error('❌ X post verification failed:', error);
      throw error;
    }
  }

  // Batch verify both retweet and X post tasks
  async verifyBatch(twitterUsername: string): Promise<BatchTwitterResult> {
    try {
      console.log(`🔍 Batch verifying Twitter for @${twitterUsername}`);
      
      const result = await this.makeRequest<BatchTwitterResult>('/verify-twitter-batch', {
        twitterUsername
      });

      console.log(`✅ Batch verification result:`, result);
      return result;
    } catch (error) {
      console.error('❌ Batch verification failed:', error);
      throw error;
    }
  }

  // Check service health
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('❌ Twitter service health check failed:', error);
      return false;
    }
  }

  // Clear cache
  async clearCache(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/clear-cache`, { method: 'POST' });
      console.log('✅ Twitter service cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear Twitter service cache:', error);
    }
  }
}

// Export singleton instance
export const twitterVerificationService = new TwitterVerificationService();
export default twitterVerificationService;

