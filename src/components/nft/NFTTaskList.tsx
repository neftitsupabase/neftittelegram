import React from "react";
import { Button } from "@/components/ui/button";
import { Twitter, MessageCircle, Check, Trophy, Sparkles, Gem, ArrowRight, Info, ChevronRight, Repeat, Edit, UserPlus, Send, Globe, HelpCircle, Target, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { NeftitLogoSymbolIcon, NFTIcon, ThunderIcon } from "../icons/CustomIcons";
import { NFTProject } from "@/types/nft";
import campaignRewardsService from "@/services/CampaignRewardsService";
import optimizedCampaignService from "@/services/OptimizedCampaignService";
import { useAuthState } from "@/hooks/useAuthState";
import { useUserConnections } from "@/hooks/useUserConnections";
import { useNavigate } from "react-router-dom";
import DiscordVerificationService from "@/services/DiscordVerificationService";
import TwitterPuppeteerService from "@/services/TwitterPuppeteerService";
import TelegramVerificationService from "@/services/TelegramVerificationService";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  type?: 'twitter_follow' | 'twitter_retweet' | 'twitter_post' | 'discord_join' | 'discord_role' | 'telegram_join' | 'visit_website' | 'quiz';
  buttonState?: 0 | 1 | 2; // 0: initial completed, 1: verify, 2: final completed
  action_url?: string;
  discord_user_id?: string; // Discord user ID for role verification
  discord_guild_id?: string; // Discord server ID
  required_role_id?: string; // Required Discord role ID
  telegram_channel_id?: string; // Telegram channel ID
  website_url?: string; // Website URL to visit
  quiz_questions?: any[]; // Quiz questions array
  quiz_passing_score?: number; // Quiz passing score
  twitter_username?: string; // Twitter username to follow
  twitter_tweet_id?: string; // Twitter tweet ID to retweet
}

interface NFTTaskListProps {
  tasks: Task[]
  p: NFTProject;
  onTaskComplete?: () => void;
}

interface ProjectData extends Omit<NFTProject, 'tasks'> {
  current_participants?: number;
  max_participants?: number;
}

export const NFTTaskList = ({ tasks: initialTasks, p, onTaskComplete }: NFTTaskListProps) => {
  // Authentication and reward claiming state - MUST BE FIRST
  const { isAuthenticated, walletAddress } = useAuthState();
  const navigate = useNavigate();

  // Get user social media connections
  const { connections: userConnections, loading: connectionsLoading } = useUserConnections(walletAddress);

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  // Initialize buttonState for each task and check user completions
  const [tasks, setTasks] = useState<Task[]>([]);

  // Initialize tasks with initial state
  useEffect(() => {
    if (initialTasks.length > 0) {
      setTasks(initialTasks.map(task => ({ ...task, buttonState: 0 as const })));
    }
  }, [initialTasks]);

  // Load user task completions and reward claiming status when authenticated
  useEffect(() => {
    const loadTaskCompletionAndRewardData = async () => {
      if (!isAuthenticated || !walletAddress || !projectData) {
        // Reset states when not authenticated
        setCanClaimReward(false);
        setRewardClaimed(false);
        return;
      }

      try {
        // Use optimized service to get project details with user completions
        const projectDetails = await optimizedCampaignService.getProjectDetails(projectData.id, walletAddress);

        if (projectDetails && projectDetails.user_completions) {
          // Update tasks with completion status from optimized backend
          setTasks(prevTasks => prevTasks.map(task => {
            const completion = projectDetails.user_completions[task.id];
            return {
              ...task,
              completed: completion?.completed || false,
              buttonState: completion?.completed ? 2 as const : 0 as const // 2 = completed, 0 = not started
            };
          }));
        }

        // Check if all tasks are completed successfully
        const backendCompletedTasks = Object.values(projectDetails.user_completions || {}).filter((c: any) => c.completed).length;
        const backendTotalTasks = projectDetails.tasks.length;
        const allTasksCompleted = backendCompletedTasks === backendTotalTasks && backendTotalTasks > 0;

        // Check reward claiming status using backend function (now includes task completion check)
        try {
          const canClaimFromBackend = await campaignRewardsService.canClaimProjectReward(walletAddress, projectData.id);

          // Backend now returns true only if: 1) All tasks completed AND 2) Not already claimed
          // So we can trust the backend response directly
          setCanClaimReward(canClaimFromBackend);

          // If backend says can't claim, check if it's because already claimed or tasks incomplete
          if (!canClaimFromBackend) {
            // If all tasks are completed but can't claim, must be already claimed
            const alreadyClaimed = allTasksCompleted;
            setRewardClaimed(alreadyClaimed);
          } else {
            // Can claim, so definitely not claimed yet
            setRewardClaimed(false);
          }

          console.log('Reward claiming status:', {
            allTasksCompleted,
            canClaimFromBackend,
            rewardClaimed: !canClaimFromBackend && allTasksCompleted,
            backendCompletedTasks,
            backendTotalTasks
          });
        } catch (rewardCheckError) {
          console.error('Error checking reward claim status:', rewardCheckError);
          // Fallback: Set claimed status to false, but still require all tasks completed
          setRewardClaimed(false);
          setCanClaimReward(allTasksCompleted); // Only allow if all tasks completed
        }
      } catch (error) {
        console.error('Error in loadTaskCompletionAndRewardData:', error);
        // Reset states on error
        setRewardClaimed(false);
        setCanClaimReward(false);

        // Fallback to direct Supabase query if optimized service fails
        try {
          const { data: completions, error } = await supabase
            .from('user_task_completions')
            .select('task_id, completed')
            .eq('wallet_address', walletAddress)
            .eq('project_id', projectData.id);

          if (!error && completions) {
            const completionMap = new Map(
              completions.map((c: any) => [c.task_id, c.completed])
            );

            setTasks(prevTasks => prevTasks.map(task => ({
              ...task,
              completed: completionMap.get(task.id) || false,
              buttonState: completionMap.get(task.id) ? 2 : 0
            })));
          }
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }
    };

    loadTaskCompletionAndRewardData();
  }, [isAuthenticated, walletAddress, projectData]);
  
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [canClaimReward, setCanClaimReward] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const completionPercentage = (completedTasks / totalTasks) * 100;

  // Helper function to check if user has connected required social media for a task
  const hasRequiredSocialConnection = (taskType?: string): boolean => {
    if (!userConnections || !taskType) return true; // No social requirement

    switch (taskType) {
      case 'twitter_follow':
      case 'twitter_retweet':
      case 'twitter_post':
        return userConnections.primary_provider === 'twitter' ||
          userConnections.linked_social_accounts.some(acc => acc.provider === 'twitter');

      case 'discord_join':
      case 'discord_role':
        return userConnections.primary_provider === 'discord' ||
          userConnections.linked_social_accounts.some(acc => acc.provider === 'discord');

      case 'telegram_join':
        return userConnections.primary_provider === 'telegram' ||
          userConnections.linked_social_accounts.some(acc => acc.provider === 'telegram');

      default:
        return true; // No social requirement for other task types
    }
  };

  // Helper function to get the required social media platform name
  const getRequiredSocialPlatform = (taskType?: string): string | null => {
    switch (taskType) {
      case 'twitter_follow':
      case 'twitter_retweet':
      case 'twitter_post':
        return 'Twitter';
      case 'discord_join':
      case 'discord_role':
        return 'Discord';
      case 'telegram_join':
        return 'Telegram';
      default:
        return null;
    }
  };

  // Handle navigation to edit profile for social media connection
  const handleConnectSocialMedia = (platform: string) => {
    toast.info(`Please connect your ${platform} account from the Edit Profile page.`);
    navigate('/edit-profile');
  };

  useEffect(() => {
    const prepareProjectData = () => {
      try {
        setLoading(true);
        // Use the project data passed as prop
        setProjectData({
          ...p,
          current_participants: (p as any).current_participants || 0,
          max_participants: (p as any).max_participants || 0
        });
      } catch (error) {
        console.error('Error preparing project data:', error);
      } finally {
        setLoading(false);
      }
    };

    prepareProjectData();
  }, [p]);


  // Handle campaign reward claiming
  const handleClaimRewards = async () => {
    if (!isAuthenticated || !walletAddress || !projectData || isClaimingReward) {
      return;
    }

    setIsClaimingReward(true);
    try {
      const result = await campaignRewardsService.claimCampaignReward(walletAddress, {
        projectId: projectData.id,
        neftReward: projectData.neftReward || 0,
        xpReward: projectData.xpReward || 0
      });

      if (result.success) {
        toast.success(result.message || 'Campaign rewards claimed successfully!');

        // Update local state
        setRewardClaimed(true);
        setCanClaimReward(false);

        // Dispatch event to update MainNav balances
        window.dispatchEvent(new CustomEvent('rewards-claimed', {
          detail: {
            neftReward: projectData.neftReward || 0,
            xpReward: projectData.xpReward || 0
          }
        }));

        // Call callback to refresh parent component
        if (onTaskComplete) {
          onTaskComplete();
        }
      } else {
        toast.error(result.message || 'Failed to claim campaign rewards.');
      }
    } catch (error) {
      console.error('Error claiming campaign reward:', error);
      toast.error('Failed to claim campaign rewards. Please try again.');
    } finally {
      setIsClaimingReward(false);
    }
  };

  // Separate function to handle Twitter task verification using Puppeteer
  const handleTwitterTaskVerification = async (task: Task) => {
    try {
      // Get user's Twitter username from their connections (handle both X and twitter naming)
      const twitterConnection = userConnections?.linked_social_accounts.find(
        acc => acc.provider === 'twitter' || acc.provider === 'X'
      );

      if (!twitterConnection) {
        toast.error('Please first connect your Twitter account from Edit Profile.');
        navigate('/edit-profile');
        return;
      }

      // Extract Twitter username
      let twitterUsername = twitterConnection.provider_id;

      // If provider_id is not available, try social_address
      if (!twitterUsername && twitterConnection.social_address) {
        twitterUsername = twitterConnection.social_address.replace('social:twitter:', '');
      }

      // Clean the Twitter username - remove @ symbol if present
      if (twitterUsername) {
        twitterUsername = twitterUsername.replace(/^@/, '');
      }

      if (!twitterUsername) {
        toast.error('Could not find your Twitter username. Please reconnect your Twitter account.');
        navigate('/edit-profile');
        return;
      }

      console.log(`🔍 Verifying Twitter task for @${twitterUsername}: ${task.type}`);

      let verificationResult;

      if (task.type === 'twitter_retweet') {
        // Verify retweet task
        if (!task.action_url) {
          return;
        }

        verificationResult = await TwitterPuppeteerService.verifyRetweet(twitterUsername, task.action_url);

      } else if (task.type === 'twitter_post') {
        // Verify tweet content task
        const keywords = ['join', 'neftit']; // Default keywords for NEFTIT posts
    
        verificationResult = await TwitterPuppeteerService.verifyTweet(twitterUsername, keywords);

      } else {
        return;
      }

      if (!verificationResult.success) {
        toast.error(verificationResult.error || 'Twitter verification failed. Please try again.');
        return;
      }

      if (!verificationResult.isVerified) {
        if (task.type === 'twitter_retweet') {
          toast.error('Retweet not found! Please make sure you have retweeted the specified tweet.');
        }
        return;
      }

      // If we reach here, Twitter verification was successful, so complete the task
      try {
        const result = await optimizedCampaignService.completeTask(
          walletAddress,
          projectData.id,
          task.id,
          {
            verification_method: 'puppeteer',
            twitter_username: twitterUsername,
            verified_at: new Date().toISOString()
          }
        );

        if (result.success) {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === task.id ? { ...t, buttonState: 2 as const, completed: true } : t
            );
            
            // Check if all tasks are now completed
            const completedCount = updatedTasks.filter(t => t.completed).length;
            const totalCount = updatedTasks.length;
            
            if (completedCount === totalCount && totalCount > 0) {
              // All tasks completed - enable claim reward button immediately
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        } else {
          toast.error(result.error || "Failed to complete Twitter task.");
        }
      } catch (error) {
        console.error('Twitter task completion error:', error);
        // Fallback to direct Supabase update
        const { error: dbError } = await supabase
          .from("user_task_completions")
          .upsert({
            wallet_address: walletAddress,
            project_id: projectData.id,
            task_id: task.id,
            completed: true,
            completed_at: new Date().toISOString(),
            verification_data: {
              verification_method: 'puppeteer',
              twitter_username: twitterUsername,
              verified_at: new Date().toISOString()
            }
          });

        if (dbError) {
          toast.error("Failed to complete Twitter task.");
          console.error('Database update error:', dbError);
        } else {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === task.id ? { ...t, buttonState: 2 as const, completed: true } : t
            );
            
            // Check if all tasks are now completed
            const completedCount = updatedTasks.filter(t => t.completed).length;
            const totalCount = updatedTasks.length;
            
            if (completedCount === totalCount && totalCount > 0) {
              // All tasks completed - enable claim reward button immediately
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        }
      }
    } catch (error) {
      console.error('Twitter verification error:', error);
    }
  };

  const handleTaskButtonClick = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // --- First Click: Open URL or Discord invite for Discord tasks ---
    if (task.buttonState === 0) {
      if (task.type === 'discord_join') {
        // For Discord join task, open Discord invite link from task's action_url
        const discordInviteLink = task.action_url || DiscordVerificationService.getDiscordInviteLink();
        console.log('Opening Discord invite:', {
          taskActionUrl: task.action_url,
          fallbackUrl: DiscordVerificationService.getDiscordInviteLink(),
          finalUrl: discordInviteLink
        });
        window.open(discordInviteLink, '_blank', 'noopener,noreferrer');
        toast.info('Please join the Discord server then click Verify to continue.');
        // Change button state to 'Verify'
        setTasks(prevTasks =>
          prevTasks.map(t => (t.id === taskId ? { ...t, buttonState: 1 as const } : t))
        );
        return;
      } else if (task.type === 'discord_role') {
        // For Discord role task, go directly to verification (no need to open Discord)
        await handleDiscordTaskVerification(task);
        return;
      } else if (task.type === 'telegram_join') {
        // For Telegram join task, open Telegram channel link
        const telegramInviteLink = TelegramVerificationService.getTelegramInviteLink();
        window.open(telegramInviteLink, '_blank', 'noopener,noreferrer');
        toast.info('Please join the Telegram channel then click Verify to continue.');
        // Change button state to 'Verify'
        setTasks(prevTasks =>
          prevTasks.map(t => (t.id === taskId ? { ...t, buttonState: 1 as const } : t))
        );
        return;
      } else if (task.type === 'twitter_retweet' || task.type === 'twitter_post') {
        // For Twitter tasks, open the action URL first
        if (task.action_url) {
          window.open(task.action_url, '_blank', 'noopener,noreferrer');
          // Change button state to 'Verify'
          setTasks(prevTasks =>
            prevTasks.map(t => (t.id === taskId ? { ...t, buttonState: 1 as const } : t))
          );
          return;
        }
      } else if (task.action_url) {
        // For other task types, open action URL
        window.open(task.action_url, '_blank', 'noopener,noreferrer');
        // Change button state to 'Verify'
        setTasks(prevTasks =>
          prevTasks.map(t => (t.id === taskId ? { ...t, buttonState: 1 as const } : t))
        );
        return;
      }
    }

    // --- Second Click: Verification Logic ---
    if (task.buttonState === 1) {
      // Puppeteer verification for Twitter tasks
      if (task.type === 'twitter_retweet' || task.type === 'twitter_post') {
        await handleTwitterTaskVerification(task);
        return;
      }

      // Special handling for Discord tasks verification
      if (task.type === 'discord_join' || task.type === 'discord_role') {
        await handleDiscordTaskVerification(task);
        return;
      }

      // Special handling for Telegram tasks verification
      if (task.type === 'telegram_join') {
        await handleTelegramTaskVerification(task);
        return;
      }

      // Default task completion for non-Discord tasks
      try {
        const result = await optimizedCampaignService.completeTask(
          walletAddress,
          projectData.id,
          taskId,
          {} // verification_data
        );

        if (result.success) {
          toast.success("Task verified and completed!");
          
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === taskId ? { ...t, buttonState: 2 as const, completed: true } : t
            );
            
            // Check if all tasks are now completed
            const completedCount = updatedTasks.filter(t => t.completed).length;
            const totalCount = updatedTasks.length;
            
            if (completedCount === totalCount && totalCount > 0) {
              // All tasks completed - enable claim reward button immediately
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        } else {
          toast.error(result.error || "Failed to verify task.");
        }
      } catch (error) {
        console.error('Optimized service error:', error);
        // Fallback to direct Supabase update
        const { error: dbError } = await supabase
          .from("user_task_completions")
          .upsert({
            wallet_address: walletAddress,
            project_id: projectData.id,
            task_id: taskId,
            completed: true,
            completed_at: new Date().toISOString(),
            verification_data: {}
          });

        if (dbError) {
          toast.error("Failed to verify task.");
          console.error('Database update error:', dbError);
        } else {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === taskId ? { ...t, buttonState: 2 as const, completed: true } : t
            );
            
            // Check if all tasks are now completed
            const completedCount = updatedTasks.filter(t => t.completed).length;
            const totalCount = updatedTasks.length;
            
            if (completedCount === totalCount && totalCount > 0) {
              // All tasks completed - enable claim reward button immediately
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        }
      }
    }
  };

  // Separate function to handle Discord task verification
  const handleDiscordTaskVerification = async (task: Task) => {
    try {
      // Get user's Discord ID from their connections - check BOTH primary account (metadata) and linked accounts
      let discordConnection = userConnections?.linked_social_accounts.find(
        acc => acc.provider === 'discord'
      );

      // If not found in linked accounts, check primary account in metadata
      if (!discordConnection && userConnections?.metadata?.provider_info?.provider_id) {
        const metadata = userConnections.metadata;
        if (metadata.created_via === 'social:discord' || metadata.provider_info?.provider_id) {
          // Create a mock connection object from metadata for consistency
          discordConnection = {
            provider: 'discord',
            provider_id: metadata.provider_info.provider_id,
            email: metadata.provider_info.email,
            social_address: `social:discord:${metadata.provider_info.provider_id}`,
            connected_at: new Date().toISOString(),
            is_primary: true,
            metadata: {
              username: metadata.provider_info.full_name || metadata.provider_info.name
            }
          };
          console.log('Found Discord in primary account metadata:', discordConnection);
        }
      }

      if (!discordConnection) {
        toast.error('Please connect your Discord account first from Edit Profile.');
        navigate('/edit-profile');
        return;
      }

      // Extract Discord user ID - try multiple possible fields
      let discordUserId = discordConnection.provider_id;

      // If provider_id is not available, try social_address
      if (!discordUserId && discordConnection.social_address) {
        discordUserId = discordConnection.social_address.replace('social:discord:', '');
      }

      // Clean the Discord user ID - remove any non-numeric characters
      if (discordUserId) {
        // Discord user IDs are numeric, so extract only numbers
        const numericId = discordUserId.toString().replace(/\D/g, '');
        if (numericId && numericId.length >= 17) { // Discord IDs are 17-19 digits
          discordUserId = numericId;
        }
      }

      // If we still don't have a valid Discord ID, try to get it from the user's profile
      if (!discordUserId || discordUserId.length < 17) {
        console.log('No valid Discord ID found in connections, checking user profile...');
        // You might need to fetch the user profile here if it's not already available
        // For now, we'll show an error
        toast.error('Discord user ID not found. Please reconnect your Discord account.');
        return;
      }

      console.log('Discord connection data:', discordConnection);
      console.log('Discord source:', discordConnection === userConnections?.linked_social_accounts.find(acc => acc.provider === 'discord') ? 'linked_social_accounts' : 'primary_metadata');
      console.log('Raw provider_id:', discordConnection.provider_id);
      console.log('Raw social_address:', discordConnection.social_address);
      console.log('Extracted Discord user ID:', discordUserId);
      console.log('Discord user ID length:', discordUserId?.length);
      console.log('Is valid Discord ID format:', discordUserId && discordUserId.length >= 17 && /^\d+$/.test(discordUserId));

      if (!discordUserId) {
        toast.error('Unable to get Discord user ID. Please reconnect your Discord account.');
        return;
      }

      if (task.type === 'discord_join') {
        console.log('Discord Join Verification:', {
          taskId: task.id,
          taskTitle: task.title,
          discordGuildId: task.discord_guild_id,
          actionUrl: task.action_url,
          usingDatabaseGuildId: !!task.discord_guild_id
        });
        
        toast.info('Verifying Discord membership...');
        // Pass task's discord_guild_id to verification
        const result = await DiscordVerificationService.verifyDiscordMembership(
          discordUserId, 
          task.discord_guild_id
        );

        console.log('Discord verification result:', result);

        if (!result.success || !result.isMember) {
          // Get Discord username from profile or connection data
          const discordUsername = discordConnection.metadata?.username || discordConnection.provider_id || 'User';
          console.log('Discord verification failed:', {
            success: result.success,
            isMember: result.isMember,
            message: result.message,
            error: result.error
          });
          toast.error(`"${discordUsername}" not joined discord! Please join the Discord server first.`);
          return;
        }

        console.log('Discord verification successful!');
        toast.success('Discord membership verified successfully!');
      } else if (task.type === 'discord_role') {
        console.log('Discord Role Verification:', {
          taskId: task.id,
          taskTitle: task.title,
          discordGuildId: task.discord_guild_id,
          requiredRoleId: task.required_role_id,
          usingDatabaseGuildId: !!task.discord_guild_id,
          usingDatabaseRoleId: !!task.required_role_id
        });
        
        toast.info('Verifying Discord role...');
        // Pass task's discord_guild_id and required_role_id to verification
        const result = await DiscordVerificationService.verifyDiscordRole(
          discordUserId,
          task.discord_guild_id,
          task.required_role_id
        );

        if (!result.success || !result.hasRole) {
          // Get Discord username from profile or connection data
          const discordUsername = discordConnection.metadata?.username || discordConnection.provider_id || 'User';
          toast.error(`"${discordUsername}" don't have role in discord! Please get the required role first.`);
          return;
        }
      }

      // If we reach here, Discord verification was successful, so complete the task
      try {
        const result = await optimizedCampaignService.completeTask(
          walletAddress,
          projectData.id,
          task.id,
          {} // verification_data
        );

        if (result.success) {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === task.id ? { ...t, buttonState: 2 as const, completed: true } : t
            );
            
            // Check if all tasks are now completed
            const completedCount = updatedTasks.filter(t => t.completed).length;
            const totalCount = updatedTasks.length;
            
            if (completedCount === totalCount && totalCount > 0) {
              // All tasks completed - enable claim reward button immediately
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        } else {
          toast.error(result.error || "Failed to complete Discord task.");
        }
      } catch (error) {
        console.error('Discord task completion error:', error);
        // Fallback to direct Supabase update
        const { error: dbError } = await supabase
          .from("user_task_completions")
          .upsert({
            wallet_address: walletAddress,
            project_id: projectData.id,
            task_id: task.id,
            completed: true,
            completed_at: new Date().toISOString(),
            verification_data: {}
          });

        if (dbError) {
          toast.error("Failed to complete Discord task.");
          console.error('Database update error:', dbError);
        } else {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === task.id ? { ...t, buttonState: 2 as const, completed: true } : t
            );
            
            // Check if all tasks are now completed
            const completedCount = updatedTasks.filter(t => t.completed).length;
            const totalCount = updatedTasks.length;
            
            if (completedCount === totalCount && totalCount > 0) {
              // All tasks completed - enable claim reward button immediately
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        }
      }
    } catch (error) {
      console.error('Discord verification error:', error);
      toast.error('Failed to verify Discord task. Please try again.');
    }
  };

  // Separate function to handle Telegram task verification
  const handleTelegramTaskVerification = async (task: Task) => {
    try {
      // Get user's Telegram ID from their connections
      const telegramConnection = userConnections?.linked_social_accounts.find(
        acc => acc.provider === 'telegram'
      );
      
      if (!telegramConnection) {
        toast.error('Please connect your Telegram account first from Edit Profile.');
        navigate('/edit-profile');
        return;
      }

      const telegramUserId = telegramConnection.provider_id || 
        telegramConnection.social_address?.replace('social:telegram:', '');

      if (!telegramUserId) {
        toast.error('Telegram user ID not found. Please reconnect your Telegram account.');
        return;
      }

      if (task.type === 'telegram_join') {
        const result = await TelegramVerificationService.verifyTelegramMembership(telegramUserId);

        if (!result.success || !result.isMember) {
          // Get Telegram username from profile or connection data
          const telegramUsername = userConnections?.linked_social_accounts.find((acc: any) => acc.provider === 'telegram')?.metadata?.username || 'User';
          toast.error(`"${telegramUsername}" not joined Telegram channel! Please join the Telegram channel first.`);
          return;
        }
      }

      // If we reach here, Telegram verification was successful, so complete the task
      try {
        const result = await optimizedCampaignService.completeTask(
          walletAddress,
          projectData.id,
          task.id,
          {
            verification_method: 'telegram_membership',
            telegram_user_id: telegramUserId,
            channel_id: TelegramVerificationService.getChannelId()
          }
        );

        if (result.success) {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === task.id ? { ...t, completed: true, buttonState: 2 as const } : t
            );
            
            // Check if all tasks are completed to enable reward claiming
            const allCompleted = updatedTasks.every(t => t.completed);
            if (allCompleted) {
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        } else {
          toast.error(result.error || "Failed to complete Telegram task.");
        }
      } catch (error) {
        console.error('Telegram task completion error:', error);
        // Fallback to direct Supabase update
        const { error: dbError } = await supabase
          .from("user_task_completions")
          .upsert({
            wallet_address: walletAddress,
            project_id: projectData.id,
            task_id: task.id,
            completed: true,
            completed_at: new Date().toISOString(),
            verification_data: {
              verification_method: 'telegram_membership',
              telegram_user_id: telegramUserId,
              channel_id: TelegramVerificationService.getChannelId()
            }
          });

        if (dbError) {
          toast.error("Failed to complete Telegram task.");
          console.error('Database update error:', dbError);
        } else {
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t =>
              t.id === task.id ? { ...t, completed: true, buttonState: 2 as const } : t
            );
            
            // Check if all tasks are completed to enable reward claiming
            const allCompleted = updatedTasks.every(t => t.completed);
            if (allCompleted) {
              setCanClaimReward(true);
              setRewardClaimed(false);
            }
            
            return updatedTasks;
          });
          // Call the callback to refresh user stats
          onTaskComplete?.();
        }
      }
    } catch (error) {
      console.error('Telegram verification error:', error);
      toast.error('Failed to verify Telegram task. Please try again.');
    }
  };

  const getTaskIcon = (type?: string) => {
    switch (type) {
      case 'twitter_follow':
        return <Twitter className="h-5 w-5 text-white" />;
      case 'twitter_retweet':
        return <Repeat className="h-5 w-5 text-white" />;
      case 'twitter_post':
        return <Edit className="h-5 w-5 text-white" />;
      case 'discord_join':
        return <MessageCircle className="h-5 w-5 text-white" />;
      case 'discord_role':
        return <UserPlus className="h-5 w-5 text-white" />;
      case 'telegram_join':
        return <Send className="h-5 w-5 text-white" />;
      case 'visit_website':
        return <Globe className="h-5 w-5 text-white" />;
      case 'quiz':
        return <HelpCircle className="h-5 w-5 text-white" />;
      default:
        return <Target className="h-5 w-5 text-white" />;
    }
  };

  useEffect(() => {
    console.log(projectData?.max_participants);
  }, []);

  return (
    <div className="w-full text-left p-0">
      {/* Header */}
      <div className="w-full text-left mb-4 sm:mb-6 mt-0 pt-0">
        <div className="flex flex-row justify-between items-center gap-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white text-left mt-0 pt-0">
            Campaign Tasks
          </h2>
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-xs sm:text-sm text-gray-300">Participants</span>
            <span className="text-xs sm:text-sm text-[#5D43EF] font-bold">
              {loading ? '...' : `${projectData?.currentParticipants || 0} / ${projectData?.maxParticipants || '∞'}`}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-sm sm:text-base text-white">Complete tasks to earn exclusive rewards</p>
        </div>
        <div className="mt-3 sm:mt-4">
          <div className="flex justify-between text-left text-xs sm:text-sm text-gray-400 mb-2">
            <span className="text-left">Campaign Progress</span>
            <span>{completedTasks}/{totalTasks} Tasks</span>
          </div>
          <Progress value={completionPercentage} className="h-2 [&>[role=progressbar]]:bg-gradient-to-l from-[#4C32E0] via-[#8073E5] to-[#D5D8F7] bg-[#1b1930]" />
        </div>
      </div>
     

      {/* Tasks - Full width landscape layout */}
      {tasks.map((task, index) => (
        <motion.div
          key={task.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="w-full h-auto border border-[#1b1930] bg-[#1b1930] hover:border hover:border-[#7b61f1] transition-all duration-200 cursor-pointer overflow-hidden rounded-lg px-3 sm:px-4 md:px-6 py-3 sm:py-4 mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
        >
          <div className="p-1.5 sm:p-2 rounded-lg bg-[#5D43EF] mr-0 sm:mr-4 mb-0 sm:mb-0 flex-shrink-0">
            {getTaskIcon(task.type)}
          </div>

          <div className="flex-grow text-left mb-2 sm:mb-0">
            <div className="font-medium text-white text-left text-sm sm:text-base md:text-lg break-words">
              {task.title}
            </div>
          </div>

          <Button
            size="sm"
            className={cn(
              "min-w-[80px] sm:min-w-[100px] md:min-w-[120px] rounded-md ml-0 sm:ml-4 h-7 sm:h-8 text-xs sm:text-sm w-full sm:w-auto",
              task.buttonState === 1
                ? "bg-[#5D43EF] hover:bg-[#5D43EF]  text-white "
                : task.buttonState === 0 && !hasRequiredSocialConnection(task.type)
                  ? "bg-amber-600 hover:bg-amber-700 text-white border-0" // Social connection needed
                  : "bg-[#5D43EF] hover:bg-[#5D43EF] text-white border-0" // Can complete task
            )}
            onClick={() => {
              // Check if user needs to connect social media first
              if (task.buttonState === 0 && !hasRequiredSocialConnection(task.type)) {
                const platform = getRequiredSocialPlatform(task.type);
                if (platform) {
                  handleConnectSocialMedia(platform);
                  return;
                }
              }

              // For Discord tasks, check if user has connected Discord
              if (task.type === 'discord_join' || task.type === 'discord_role') {
                const discordConnected = userConnections?.linked_social_accounts.some(
                  acc => acc.provider === 'discord'
                ) || userConnections?.primary_provider === 'discord';

                if (!discordConnected) {
                  toast.error('Please connect your Discord account first in Edit Profile.');
                  navigate('/edit-profile');
                  return;
                }
              }

              handleTaskButtonClick(task.id);
            }}
            disabled={task.buttonState === 2}
          >
            {task.buttonState === 0 && (
              <>
                {!hasRequiredSocialConnection(task.type) ? (
                  <>
                    {task.type?.includes('twitter') && <Twitter className="h-3 w-3 mr-1" />}
                    {task.type?.includes('discord') && <MessageCircle className="h-3 w-3 mr-1" />}
                    {task.type?.includes('telegram') && <Send className="h-3 w-3 mr-1" />}
                    Connect {getRequiredSocialPlatform(task.type)}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    {task.type === 'discord_join' && 'Join Discord'}
                    {task.type === 'discord_role' && 'Verify Role'}
                    {task.type !== 'discord_join' && task.type !== 'discord_role' && 'Complete Task'}
                  </>
                )}
              </>
            )}
            {task.buttonState === 1 && (
              <>
                Verify Task
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-1.5" />
              </>
            )}
            {task.buttonState === 2 && (
              <>
                <span className="text-white">Completed</span>
                <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-white" />
              </>
            )}
          </Button>
        </motion.div>
      ))}

      {/* Rewards Section */}
      <div className="relative mt-6 sm:mt-10 bg-[#1b1930] border border-[#5D43EF]/40 p-3 sm:p-4 md:p-6 w-full text-left rounded-lg">
        <div className="absolute -top-3 sm:-top-4 left-3 sm:left-4 md:left-6 z-10">
          <span className="inline-block bg-[#5D43EF] px-2 sm:px-3 md:px-4 py-1 rounded-full text-white shadow-sm text-xs sm:text-sm md:text-base" >Campaign Rewards</span>
        </div>

        <div className="flex flex-col lg:flex-row justify-between gap-4 sm:gap-6 mt-4 ml-0 sm:ml-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-8 text-left w-full lg:w-fit">
            <div className="flex flex-row justify-between sm:flex-col items-center text-left w-full">
              <div className="flex items-center gap-2 mb-1 sm:mb-2 text-left">
                <NeftitLogoSymbolIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                <span className="text-white text-xs sm:text-sm md:text-base whitespace-nowrap">NEFT Reward</span>
              </div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-[#5D43EF] mt-1">
                {loading ? '...' : projectData?.neftReward || 0}
              </div>
            </div>

            <div className="flex flex-row justify-between sm:flex-col items-center text-left w-full">
              <div className="flex items-center gap-2 mb-1 sm:mb-2 text-left">
                <ThunderIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                <span className="text-white text-xs sm:text-sm md:text-base whitespace-nowrap">XP Gained</span>
              </div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-[#5D43EF] mt-1">
                {loading ? '...' : `${projectData?.xpReward || 0}+`}
              </div>
            </div>
          </div>

          <div className="sm:mt-4 lg:mt-0 flex flex-col items-center lg:mr-12 w-full lg:w-auto">
            <Button
              className={cn(
                "rounded-full px-2 h-8 sm:h-10 font-medium w-full sm:w-48 text-white text-xs sm:text-sm md:text-base mt-2 sm:mt-0 transition-all duration-200",
                rewardClaimed || !canClaimReward
                  ? "bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] cursor-not-allowed"
                  : completedTasks === totalTasks
                    ? "bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:bg-black"
                    : "bg-[#0B0A14] border border-[#5D43EF] hover:bg-[#5D43EF]"
              )}
              disabled={completedTasks !== totalTasks || isClaimingReward || rewardClaimed || !isAuthenticated}
              onClick={handleClaimRewards}
            >
              {rewardClaimed ? (
                <>
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-white" />
                  <span className="text-white">Already Claimed</span>
                </>
              ) : isClaimingReward ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1"></div>
                  <span className="text-white">Claiming...</span>
                </>
              ) : completedTasks === totalTasks && isAuthenticated ? (
                <>
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-white" />
                  <span className="text-white">Claim Rewards</span>
                </>
              ) : !isAuthenticated ? (
                <>
                  <span className="text-white">Connect Wallet</span>
                </>
              ) : (
                <>
                  <span className="text-white">Complete Tasks ({completedTasks}/{totalTasks})</span>
                </>
              )}
            </Button>
            <div className="flex items-start justify-center sm:gap-2 text-white text-xs sm:text-sm mt-3 sm:mt-4 w-full">
              <Info className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
             
              <span className="text-center text-xs sm:text-sm">NFTs will be claimable after campaign end</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
