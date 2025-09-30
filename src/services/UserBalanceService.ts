import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getWalletSupabaseClient } from '../lib/supabaseClientManager';
import { UserBalance, BalanceBreakdown, BalanceUpdate, CachedBalance, PendingUpdate } from '../types/balance';

class OptimizedUserBalanceService {
  private supabase: SupabaseClient;
  private clientCache: Map<string, SupabaseClient> = new Map();



  // Event subscribers
  private subscribers: Map<string, Set<(balance: UserBalance) => void>> = new Map();

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Use centralized client with wallet header
  private createClientWithWalletHeader(walletAddress: string): SupabaseClient {
    // Use centralized SupabaseClientManager
    return getWalletSupabaseClient(walletAddress);
  }

  // Get user's complete balance - ALWAYS from backend, NO CACHING
  async getUserBalance(walletAddress: string, forceRefresh: boolean = false): Promise<UserBalance> {
    try {
      console.log(`Getting balance for wallet: ${walletAddress} - ALWAYS FRESH FROM BACKEND`);

      // ALWAYS fetch fresh data from Supabase backend
      const balance = await this.fetchCompleteBalanceFromSupabase(walletAddress);

      console.log('Fresh balance fetched from backend:', balance);

      // Notify subscribers with fresh data
      this.notifySubscribers(walletAddress, balance);

      return balance;
    } catch (error) {
      console.error('Error in getUserBalance:', error);
      // NO FALLBACK TO CACHE - return defaults only
      return this.getDefaultBalance();
    }
  }

  // Fetch unified balance across all linked accounts (primary wallet + social accounts)
  private async fetchCompleteBalanceFromSupabase(walletAddress: string): Promise<UserBalance> {
    try {
      console.log(`Fetching unified balance for wallet/account: ${walletAddress}`);
      const client = this.createClientWithWalletHeader(walletAddress);

        // Skip RPC call and go directly to table query (RPC is failing with 400 errors)
        console.log('Querying user_balances table directly (RPC has issues)...');
        
        const { data: fallbackData, error: fallbackError } = await client
            .from('user_balances')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();

        if (fallbackError) {
            console.error('Direct table query failed:', fallbackError);
            // Return zero balance if no record exists
            return {
                total_neft_claimed: 0,
                total_xp_earned: 0,
                total_nfts_owned: 0,
                available_neft: 0,
                available_xp: 0,
                staked_neft: 0,
                staked_tokens: 0,
                current_level: 1,
                referral_neft: 0,
                referral_xp: 0,
                referral_count: 0,
                last_updated: new Date().toISOString()
            };
        }

        console.log('Direct table data:', fallbackData);
      return {
            total_neft_claimed: parseFloat(fallbackData?.total_neft_claimed || '0'),
            total_xp_earned: parseInt(fallbackData?.total_xp_earned || '0'),
            total_nfts_owned: parseInt(fallbackData?.total_nft_count || '0'),
            available_neft: parseFloat(fallbackData?.available_neft || '0'),
            available_xp: parseInt(fallbackData?.total_xp_earned || '0'),
            staked_neft: parseFloat(fallbackData?.staked_neft || fallbackData?.staked_amount || '0'),
            staked_tokens: parseFloat(fallbackData?.staked_neft || fallbackData?.staked_amount || '0'),
            current_level: parseInt(fallbackData?.current_level || '1'),
            referral_neft: parseFloat(fallbackData?.referral_neft || '0'),
            referral_xp: parseInt(fallbackData?.referral_xp || '0'),
            referral_count: parseInt(fallbackData?.referral_count || '0'),
            last_updated: fallbackData?.last_updated || new Date().toISOString()
        };

    } catch (error) {
      console.error('Error in fetchCompleteBalanceFromSupabase:', error);
      throw error;
    }
  }

  // Get balance breakdown by source
  async getBalanceBreakdown(walletAddress: string): Promise<BalanceBreakdown> {
    try {
      const client = this.createClientWithWalletHeader(walletAddress);

      // Query user_balances table directly (RPC has issues)
      const { data: balanceData, error } = await client
        .from('user_balances')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        console.error('Error getting balance breakdown:', error);
        return this.getDefaultBreakdown();
      }

      const result = balanceData;

      return {
        campaign_rewards: parseFloat(result?.campaign_rewards || '0'),
        daily_claims: parseFloat(result?.daily_claims || '0'),
        achievements: parseFloat(result?.achievements || '0'),
        referral_rewards: parseFloat(result?.referral_rewards || '0'),
        staking_rewards: parseFloat(result?.staking_rewards || '0')
      };
    } catch (error) {
      console.error('Error in getBalanceBreakdown:', error);
      return this.getDefaultBreakdown();
    }
  }

  // Initialize user balance record for new users
  public async initializeUserBalance(walletAddress: string): Promise<boolean> {
    try {
      console.log(`Initializing balance record for new user: ${walletAddress}`);
      const client = this.createClientWithWalletHeader(walletAddress);

      // Insert default balance record with proper defaults (matching actual schema)
      const { data, error } = await client
        .from('user_balances')
        .upsert({
          wallet_address: walletAddress,
          total_neft_claimed: 0,
          total_xp_earned: 0,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'wallet_address',
          ignoreDuplicates: true // Don't overwrite existing records
        })
        .select();

      if (error) {
        console.error('❌ Error initializing user balance:', error);
        return false;
      }

      console.log('✅ User balance initialized successfully:', data);
      return true;
    } catch (error) {
      console.error('❌ Unexpected error in initializeUserBalance:', error);
      return false;
    }
  }

  // Add balance directly to user_balances table
  public async addBalance(
    walletAddress: string,
    neftAmount: number,
    xpAmount: number,
    source: string = 'Direct Update'
  ): Promise<boolean> {
    try {
      console.log(`Adding balance for ${walletAddress}: +${neftAmount} NEFT, +${xpAmount} XP from ${source}`);
      const client = this.createClientWithWalletHeader(walletAddress);

      // Get existing balance first, then add to it (don't overwrite)
      const { data: existingData } = await client
        .from('user_balances')
        .select('total_neft_claimed, total_xp_earned, available_neft')
        .eq('wallet_address', walletAddress)
        .single();

      const currentNeft = existingData?.total_neft_claimed || 0;
      const currentXp = existingData?.total_xp_earned || 0;
      const currentAvailable = existingData?.available_neft || 0;

      // Add to existing balance instead of overwriting
      const { data, error } = await client
        .from('user_balances')
        .upsert({
          wallet_address: walletAddress,
          total_neft_claimed: currentNeft + neftAmount,
          total_xp_earned: currentXp + xpAmount,
          available_neft: currentAvailable + neftAmount,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'wallet_address',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('❌ Error adding balance to user_balances:', error);
        // Try to get existing balance first, then update
        const { data: existingData } = await client
          .from('user_balances')
          .select('total_neft_claimed, total_xp_earned, available_neft')
          .eq('wallet_address', walletAddress)
          .single();

        const currentNeft = existingData?.total_neft_claimed || 0;
        const currentXp = existingData?.total_xp_earned || 0;
        const currentAvailable = existingData?.available_neft || 0;

        const { data: updateData, error: updateError } = await client
          .from('user_balances')
          .update({
            total_neft_claimed: currentNeft + neftAmount,
            total_xp_earned: currentXp + xpAmount,
            available_neft: currentAvailable,
            last_updated: new Date().toISOString()
          })
          .eq('wallet_address', walletAddress)
          .select();

        if (updateError) {
          console.error('❌ Error updating existing balance:', updateError);
          return false;
        }
        console.log('✅ Balance updated successfully:', updateData);
      } else {
        console.log('✅ Balance added successfully:', data);
      }

      // Refresh balance and notify subscribers
      const updatedBalance = await this.getUserBalance(walletAddress, true);
      this.notifySubscribers(walletAddress, updatedBalance);

      return true;
    } catch (error) {
      console.error('❌ Unexpected error in addBalance:', error);
      return false;
    }
  }

  // Request balance sync
  public async requestBalanceSync(walletAddress: string, source: string = 'unknown'): Promise<boolean> {
    try {
      console.log(`🔄 Requesting balance sync for wallet: ${walletAddress} from source: ${source}`);
      const client = this.createClientWithWalletHeader(walletAddress);

      const { data, error } = await client.rpc('sync_user_balance_from_all_sources', {
        user_wallet: walletAddress
      });

      if (error) {
        console.error('❌ Error during balance sync:', error);
        return false;
      }

      console.log('✅ Balance sync successful:', data);

      // Notify subscribers and emit legacy event to ensure UI updates
      this.getUserBalance(walletAddress, true);
      this.emitBalanceUpdateEvent(walletAddress);

      return true;
    } catch (error) {
      console.error('❌ Unexpected error in requestBalanceSync:', error);
      return false;
    }
  }

  // Handle staking operations - moves NEFT from available to staked
  async stakeTokens(
    walletAddress: string,
    amount: number,
    reason: string = 'Token Staking'
  ): Promise<boolean> {
    try {
      console.log(`Staking ${amount} NEFT for ${walletAddress}`);

      // Get current balance to validate
      const currentBalance = await this.getUserBalance(walletAddress);

      // Validate sufficient available balance
      if (currentBalance.available_neft < amount) {
        console.error('Insufficient available NEFT balance for staking');
        return false;
      }

      // Update database - move from available to staked
      const client = this.createClientWithWalletHeader(walletAddress);
      const { error } = await client.rpc('update_staking_balance', {
        user_wallet: walletAddress,
        stake_amount: amount,
        operation: 'stake'
      });

      if (error) {
        console.error('Error updating staking balance in database:', error);
        return false;
      }

      // Refresh balance and notify subscribers
      const updatedBalance = await this.getUserBalance(walletAddress, true);
      this.notifySubscribers(walletAddress, updatedBalance);
      this.emitBalanceUpdateEvent(walletAddress);

      console.log(`Successfully staked ${amount} NEFT - Balance updated`);
      return true;
    } catch (error) {
      console.error('Error in stakeTokens:', error);
      return false;
    }
  }

  // Handle unstaking operations - moves NEFT from staked back to available
  async unstakeTokens(
    walletAddress: string,
    amount: number,
    reason: string = 'Token Unstaking'
  ): Promise<boolean> {
    try {
      console.log(`Unstaking ${amount} NEFT for ${walletAddress}`);

      // Update database - move from staked to available
      const client = this.createClientWithWalletHeader(walletAddress);
      const { error } = await client.rpc('update_staking_balance', {
        user_wallet: walletAddress,
        stake_amount: amount,
        operation: 'unstake'
      });

      if (error) {
        console.error('Error updating unstaking balance in database:', error);
        return false;
      }

      // Refresh balance and notify subscribers
      const updatedBalance = await this.getUserBalance(walletAddress, true);
      this.notifySubscribers(walletAddress, updatedBalance);
      this.emitBalanceUpdateEvent(walletAddress);

      console.log(`Successfully unstaked ${amount} NEFT - Balance updated`);
      return true;
    } catch (error) {
      console.error('Error in unstakeTokens:', error);
      return false;
    }
  }

  // Link account to primary wallet (for profile editing)
  async linkAccountToPrimary(
    primaryWallet: string,
    newAccount: string,
    accountType: 'wallet' | 'social' = 'wallet'
  ): Promise<boolean> {
    try {
      console.log(`🔗 Linking ${accountType} account ${newAccount} to primary wallet ${primaryWallet}`);
      const client = this.createClientWithWalletHeader(primaryWallet);

      const { data, error } = await client.rpc('link_account_to_primary', {
        primary_wallet: primaryWallet,
        new_account: newAccount,
        account_type: accountType
      });

      if (error) {
        console.error('❌ Error linking account:', error);
        return false;
      }

      console.log('✅ Account linked successfully:', data);

      // Refresh balance for both accounts to show unified balance
      await this.getUserBalance(primaryWallet, true);
      await this.getUserBalance(newAccount, true);

      return true;
    } catch (error) {
      console.error('❌ Error in linkAccountToPrimary:', error);
      return false;
    }
  }

  // Event subscription for real-time updates
  subscribeToBalanceUpdates(
    walletAddress: string,
    callback: (balance: UserBalance) => void
  ): () => void {
    if (!this.subscribers.has(walletAddress)) {
      this.subscribers.set(walletAddress, new Set());
    }

    this.subscribers.get(walletAddress)!.add(callback);

    // Set up real-time subscription if first subscriber
    if (this.subscribers.get(walletAddress)!.size === 1) {
      this.setupRealtimeSubscription(walletAddress);
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(walletAddress);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(walletAddress);
        }
      }
    };
  }

  private setupRealtimeSubscription(walletAddress: string): void {
    this.supabase
      .channel(`balance_${walletAddress}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_balances',
        filter: `wallet_address=eq.${walletAddress}`
      }, () => {
        console.log(`Real-time balance update for ${walletAddress}`);
        this.getUserBalance(walletAddress, true);
      })
      .subscribe();
  }

  private notifySubscribers(walletAddress: string, balance: UserBalance): void {
    const subs = this.subscribers.get(walletAddress);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(balance);
        } catch (error) {
          console.error('Error in balance subscriber callback:', error);
        }
      });
    }
  }

  // Emit balance update event for legacy components
  emitBalanceUpdateEvent(walletAddress: string, rewards?: { neftReward?: number; xpReward?: number }): void {
    try {
      // Just emit the event - database trigger will handle balance updates automatically
      const event = new CustomEvent('balanceUpdate', {
        detail: {
          walletAddress,
          rewards: rewards || null
        }
      });
      window.dispatchEvent(event);
      console.log(`Balance update event emitted for wallet: ${walletAddress}`, rewards ? `with rewards: ${JSON.stringify(rewards)}` : '');

      // Refresh balance from database to get updated values
      setTimeout(() => {
        this.getUserBalance(walletAddress, true);
      }, 100);
    } catch (error) {
      console.error('Error emitting balance update event:', error);
    }
  }

  // Utility methods
  private getDefaultBalance(): UserBalance {
    return {
      total_neft_claimed: 0,
      total_xp_earned: 0,
      available_neft: 0,
      available_xp: 0,
      staked_tokens: 0,
      total_nfts_owned: 0,
      staked_neft: 0,
      current_level: 1,
      referral_neft: 0,
      referral_xp: 0,
      referral_count: 0,
      last_updated: new Date().toISOString()
    };
  }

  private getDefaultBreakdown(): BalanceBreakdown {
    return {
      campaign_rewards: 0,
      daily_claims: 0,
      achievements: 0,
      referral_rewards: 0,
      staking_rewards: 0
    };
  }

  // Cleanup
  destroy(): void {
    this.subscribers.clear();
    this.clientCache.clear();
  }
}

// Export singleton instance
const userBalanceService = new OptimizedUserBalanceService();
export default userBalanceService;


