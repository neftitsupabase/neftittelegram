import { SupabaseClient } from '@supabase/supabase-js';
import { NFTProject, NFTRarity } from '@/types/nft';
import ipfsService, { NFTData } from './IPFSService';
import { getSupabaseClient } from '../lib/supabaseClientManager';

// Types for campaign end handling
interface CampaignEndUser {
  wallet_address: string;
  project_id: string;
  participated_at: string;
  eligible_for_nft: boolean;
  assigned_rarity?: NFTRarity;
}

interface NFTDistribution {
  wallet_address: string;
  nft_data: NFTData;
  rarity: NFTRarity;
  project_id: string;
}

interface CampaignEndResult {
  success: boolean;
  message: string;
  processed_users: number;
  distributed_nfts: number;
  errors?: string[];
}

class CampaignEndService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // Check if a campaign has ended
  async isCampaignEnded(project: NFTProject): Promise<boolean> {
    const now = new Date();
    const endTime = new Date(project.endTime);
    return now >= endTime;
  }

  // FIXED: Get only users who completed ALL tasks successfully
  async getSuccessfulCampaignCompleters(projectId: string): Promise<string[]> {
    try {
      console.log(`Getting successful completers for campaign: ${projectId}`);

      // First, get total number of tasks for this project
      const { data: totalTasksData, error: tasksError } = await this.supabase
        .from('project_tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('is_active', true);

      if (tasksError) {
        console.error('Error getting project tasks:', tasksError);
        return [];
      }

      const totalTasks = totalTasksData?.length || 0;
      
      if (totalTasks === 0) {
        console.log('No active tasks found for this project');
        return [];
      }

      console.log(`Project has ${totalTasks} active tasks`);

      // Get users who completed ALL tasks for this project
      const { data: completions, error: completionsError } = await this.supabase
        .from('user_task_completions')
        .select('wallet_address, task_id')
        .eq('project_id', projectId)
        .eq('completed', true);

      if (completionsError) {
        console.error('Error getting task completions:', completionsError);
        return [];
      }

      // Group completions by wallet address
      const userCompletions: { [wallet: string]: number } = {};
      completions?.forEach(completion => {
        if (!userCompletions[completion.wallet_address]) {
          userCompletions[completion.wallet_address] = 0;
        }
        userCompletions[completion.wallet_address]++;
      });

      // Filter users who completed ALL tasks
      const successfulCompleters = Object.entries(userCompletions)
        .filter(([wallet, completedCount]) => completedCount === totalTasks)
        .map(([wallet]) => wallet);

      console.log(`Found ${successfulCompleters.length} users who completed all ${totalTasks} tasks`);
      console.log('Successful completers:', successfulCompleters);

      return successfulCompleters;
    } catch (error) {
      console.error('Error in getSuccessfulCampaignCompleters:', error);
      return [];
    }
  }

  // FIXED: Distribute exactly ONE NFT per successful completer based on rarity
  private async distributeOneNFTPerUser(
    successfulCompleters: string[],
    project: NFTProject
  ): Promise<NFTDistribution[]> {
    const distributions: NFTDistribution[] = [];

    if (!project.rarityDistribution || successfulCompleters.length === 0) {
      return distributions;
    }

    const totalCompleters = successfulCompleters.length;
    const rarityDistribution = project.rarityDistribution;

    // Calculate how many NFTs of each rarity to distribute
    const legendaryCount = Math.floor((rarityDistribution.legendary / 100) * totalCompleters);
    const rareCount = Math.floor((rarityDistribution.rare / 100) * totalCompleters);
    const commonCount = totalCompleters - legendaryCount - rareCount;

    console.log(`NFT Distribution for ${totalCompleters} successful completers:`, {
      legendary: legendaryCount,
      rare: rareCount,
      common: commonCount,
      total: legendaryCount + rareCount + commonCount
    });

    // Shuffle completers for random rarity assignment
    const shuffledCompleters = [...successfulCompleters].sort(() => Math.random() - 0.5);

    let completerIndex = 0;

    // Distribute Legendary NFTs (highest rarity first)
    for (let i = 0; i < legendaryCount && completerIndex < shuffledCompleters.length; i++) {
      const nftData = await this.generateNFTFromIPFS('Legendary', project);
      if (nftData) {
        distributions.push({
          wallet_address: shuffledCompleters[completerIndex],
          nft_data: nftData,
          rarity: 'Legendary',
          project_id: project.id
        });
        console.log(`Assigned Legendary NFT to: ${shuffledCompleters[completerIndex]}`);
      }
      completerIndex++;
    }

    // Distribute Rare NFTs
    for (let i = 0; i < rareCount && completerIndex < shuffledCompleters.length; i++) {
      const nftData = await this.generateNFTFromIPFS('Rare', project);
      if (nftData) {
        distributions.push({
          wallet_address: shuffledCompleters[completerIndex],
          nft_data: nftData,
          rarity: 'Rare',
          project_id: project.id
        });
        console.log(`Assigned Rare NFT to: ${shuffledCompleters[completerIndex]}`);
      }
      completerIndex++;
    }

    // Distribute Common NFTs (remaining users)
    for (let i = 0; i < commonCount && completerIndex < shuffledCompleters.length; i++) {
      const nftData = await this.generateNFTFromIPFS('Common', project);
      if (nftData) {
        distributions.push({
          wallet_address: shuffledCompleters[completerIndex],
          nft_data: nftData,
          rarity: 'Common',
          project_id: project.id
        });
        console.log(`Assigned Common NFT to: ${shuffledCompleters[completerIndex]}`);
      }
      completerIndex++;
    }

    console.log(`Successfully created ${distributions.length} NFT distributions`);
    return distributions;
  }

  // Generate NFT data from IPFS based on rarity
  private async generateNFTFromIPFS(rarity: NFTRarity, project: NFTProject): Promise<NFTData | null> {
    try {
      // Generate a unique NFT based on the project and rarity
      const nftData: NFTData = {
        id: `${project.id}_${rarity}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${project.nftName} - ${rarity}`,
        description: `${rarity} NFT from ${project.projectName} campaign`,
        image: project.image, // Use project image as base, could be enhanced with rarity-specific images
        rarity: rarity,
        attributes: [
          {
            trait_type: "Rarity",
            value: rarity
          },
          {
            trait_type: "Campaign",
            value: project.projectName
          },
          {
            trait_type: "Collection",
            value: project.nftName
          },
          {
            trait_type: "Network",
            value: project.network
          }
        ],
        wallet_address: '', // Will be set when distributed
        created_at: new Date().toISOString(),
        ipfs_hash: `Qm${Math.random().toString(36).substr(2, 44)}`, // Generate mock IPFS hash
        metadata_uri: `ipfs://Qm${Math.random().toString(36).substr(2, 44)}`,
        tier: 1, // Default tier
        collection: project.nftName,
        burnValue: rarity === 'Legendary' ? 100 : rarity === 'Rare' ? 50 : 25,
        claimed: false // Mark as unclaimed so users can claim after campaign end
      };

      return nftData;
    } catch (error) {
      console.error('Error generating NFT from IPFS:', error);
      return null;
    }
  }

  // Add users to burn, stake, and profile pages via IPFS+Supabase (ONE NFT per user)
  private async addUsersToPages(distributions: NFTDistribution[]): Promise<void> {
    try {
      console.log(`Adding ${distributions.length} NFTs to ${distributions.length} users (1 NFT per user)`);

      // Verify each user gets exactly one NFT
      const userNFTCount: { [wallet: string]: number } = {};
      distributions.forEach(distribution => {
        userNFTCount[distribution.wallet_address] = (userNFTCount[distribution.wallet_address] || 0) + 1;
      });

      // Log any users getting multiple NFTs (should not happen)
      Object.entries(userNFTCount).forEach(([wallet, count]) => {
        if (count > 1) {
          console.warn(`WARNING: User ${wallet} is getting ${count} NFTs instead of 1!`);
        }
      });

      // Process each NFT distribution
      for (const distribution of distributions) {
        try {
          // Import the IPFS burn service to access user data methods
          const { default: ipfsBurnService } = await import('./IPFSBurnService');

          // Get existing user data from IPFS
          const userData = await ipfsBurnService['getUserDataFromIPFS'](distribution.wallet_address);

          // Set the wallet address and mark as unclaimed (ready to be claimed by user)
          distribution.nft_data.wallet_address = distribution.wallet_address;
          distribution.nft_data.claimed = false;
          distribution.nft_data.created_at = new Date().toISOString();

          // Add the single NFT to user's collection
          userData.nfts.push(distribution.nft_data);

          // Update timestamp and save to IPFS
          userData.last_updated = new Date().toISOString();
          await ipfsBurnService['saveUserDataToIPFS'](userData);

          console.log(`✅ Added 1 ${distribution.rarity} NFT to wallet: ${distribution.wallet_address}`);
        } catch (error) {
          console.error(`❌ Error processing NFT for wallet ${distribution.wallet_address}:`, error);
          // Continue with other users even if one fails
        }
      }

      console.log(`✅ Successfully distributed ${distributions.length} NFTs to ${Object.keys(userNFTCount).length} users`);
    } catch (error) {
      console.error('Error adding users to pages:', error);
      throw error;
    }
  }

  // Record campaign end processing
  private async recordCampaignEndProcessing(projectId: string, result: CampaignEndResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('campaign_end_processing')
        .upsert({
          project_id: projectId,
          processed_at: new Date().toISOString(),
          result: result,
          success: result.success
        });

      if (error) {
        console.error('Error recording campaign end processing:', error);
      }
    } catch (error) {
      console.error('Error in recordCampaignEndProcessing:', error);
    }
  }

  // Check if campaign end has already been processed
  private async isCampaignEndProcessed(projectId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('campaign_end_processing')
        .select('id')
        .eq('project_id', projectId)
        .eq('success', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking campaign end processing:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in isCampaignEndProcessed:', error);
      return false;
    }
  }

  // FIXED: Main function to process campaign end (ONE NFT per successful completer)
  async processCampaignEnd(project: NFTProject): Promise<CampaignEndResult> {
    try {
      console.log(`🚀 Processing campaign end for: ${project.projectName} (${project.id})`);

      // Check if already processed
      const alreadyProcessed = await this.isCampaignEndProcessed(project.id);
      if (alreadyProcessed) {
        console.log('Campaign end already processed, skipping...');
        return {
          success: true,
          message: 'Campaign end already processed',
          processed_users: 0,
          distributed_nfts: 0
        };
      }

      // Check if campaign has ended
      const hasEnded = await this.isCampaignEnded(project);
      if (!hasEnded) {
        console.log('Campaign has not ended yet, skipping...');
        return {
          success: false,
          message: 'Campaign has not ended yet',
          processed_users: 0,
          distributed_nfts: 0
        };
      }

      // Get users who completed ALL tasks successfully
      const successfulCompleters = await this.getSuccessfulCampaignCompleters(project.id);

      if (successfulCompleters.length === 0) {
        const result: CampaignEndResult = {
          success: true,
          message: 'No users completed all tasks successfully',
          processed_users: 0,
          distributed_nfts: 0
        };

        await this.recordCampaignEndProcessing(project.id, result);
        return result;
      }

      // Distribute exactly ONE NFT per successful completer
      const distributions = await this.distributeOneNFTPerUser(successfulCompleters, project);

      // Add users to burn, stake, and profile pages
      await this.addUsersToPages(distributions);

      const result: CampaignEndResult = {
        success: true,
        message: `Successfully processed campaign end. Distributed ${distributions.length} NFTs to ${successfulCompleters.length} successful completers (1 NFT each).`,
        processed_users: successfulCompleters.length,
        distributed_nfts: distributions.length
      };

      // Record the processing
      await this.recordCampaignEndProcessing(project.id, result);

      console.log('✅ Campaign end processing completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Error processing campaign end:', error);

      const result: CampaignEndResult = {
        success: false,
        message: 'Failed to process campaign end',
        processed_users: 0,
        distributed_nfts: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };

      await this.recordCampaignEndProcessing(project.id, result);
      return result;
    }
  }

  // Utility function to process all ended campaigns
  async processAllEndedCampaigns(): Promise<CampaignEndResult[]> {
    try {
      console.log('🚀 Processing all ended campaigns...');

      // Get all projects from Supabase that have ended
      const { data: projects, error } = await this.supabase
        .from('projects')
        .select('*')
        .lt('end_date', new Date().toISOString());

      if (error) {
        console.error('Error fetching ended campaigns:', error);
        return [];
      }

      const results: CampaignEndResult[] = [];

      for (const projectRow of projects || []) {
        // Map project data to NFTProject type
        const project: NFTProject = {
          id: projectRow.id,
          projectName: projectRow.title,
          nftName: projectRow.collection_name,
          image: projectRow.image_url,
          endTime: projectRow.end_date,
          startTime: projectRow.start_date,
          xpReward: projectRow.xp_reward,
          neftReward: projectRow.reward_amount,
          description: projectRow.description,
          owner: projectRow.owner,
          currentParticipants: projectRow.current_participants || 0,
          maxParticipants: projectRow.max_participants || 100,
          totalSupply: projectRow.total_supply,
          levelRequirement: projectRow.level_requirement,
          category: projectRow.category,
          subcategory: projectRow.subcategory,
          taskStatus: projectRow.task_status,
          usdValue: projectRow.usd_value,
          network: projectRow.network,
          isOffchain: projectRow.is_offchain,
          targetChain: projectRow.target_chain,
          claimStatus: projectRow.claim_status,
          website: projectRow.website,
          twitter: projectRow.twitter,
          discord: projectRow.discord,
          rarityDistribution: projectRow.rarity_distribution,
          tasks: []
        };

        const result = await this.processCampaignEnd(project);
        results.push(result);
      }

      console.log(`✅ Processed ${results.length} ended campaigns`);
      return results;

    } catch (error) {
      console.error('❌ Error processing all ended campaigns:', error);
      return [];
    }
  }
}

// Export singleton instance
const campaignEndService = new CampaignEndService();
export default campaignEndService;

// Export types
export type {
  CampaignEndUser,
  NFTDistribution,
  CampaignEndResult
};
