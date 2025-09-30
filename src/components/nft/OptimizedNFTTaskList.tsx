// import React, { useState, useEffect } from "react";
// import { motion } from "framer-motion";
// import {
//   Twitter,
//   MessageCircle,
//   Shield,
//   Target,
//   CheckCircle,
//   Loader2,
//   Play,
//   Clock,
//   Users,
//   Trophy,
//   Coins,
//   Zap,
//   Repeat,
//   Edit,
//   UserPlus,
//   Send,
//   HelpCircle,
//   Globe,
//   Award,
//   TrendingUp,
//   ExternalLink,
//   Gift
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// // Using a simple alert for now - you can implement Radix UI toast if needed
// // import { toast } from "react-hot-toast";
// import optimizedCampaignService, { ProjectTask, UserTaskCompletion } from "@/services/OptimizedCampaignService";
// import optimizedUserService from "@/services/OptimizedUserService";
// import { getWalletAddress, getAuthStatus } from "@/utils/authUtils";
// import campaignRewardsService from "@/services/CampaignRewardsService";

// interface NFTProject {
//   id: string;
//   projectName: string;
//   nftName: string;
//   description: string;
//   imageUrl: string;
//   neftReward: number;
//   xpReward: number;
//   totalSupply: number;
//   participantsCount: number;
//   timeLeft: string;
//   category: string;
//   blockchain: string;
//   website?: string;
//   twitter?: string;
//   discord?: string;
//   rarityDistribution: {
//     common: number;
//     rare: number;
//     legendary: number;
//   };
//   tasks: ProjectTask[];
//   status: 'active' | 'ended' | 'upcoming';
//   endDate?: string;
//   level_requirement?: number;
//   usd_value?: number;
//   claim_status?: string;
//   task_status?: string;
// }

// // Remove local Task interface - using ProjectTask from OptimizedCampaignService instead
// // This ensures consistency with the new task types:
// // twitter_follow, twitter_retweet, twitter_post, discord_join, discord_role, telegram_join, visit_website, quiz

// interface OptimizedNFTTaskListProps {
//   tasks: ProjectTask[];
//   projectData: NFTProject;
//   userCompletions: Record<string, UserTaskCompletion>;
//   onTaskComplete?: (taskId: string) => void;
//   onRewardsClaim?: () => void;
// }

// const OptimizedNFTTaskList: React.FC<OptimizedNFTTaskListProps> = ({
//   tasks,
//   projectData,
//   userCompletions,
//   onTaskComplete,
//   onRewardsClaim,
// }) => {
//   const [taskStates, setTaskStates] = useState<Record<string, number>>({});
//   const [completingTask, setCompletingTask] = useState<string | null>(null);
//   const [isClaimingReward, setIsClaimingReward] = useState(false);
//   const [rewardClaimed, setRewardClaimed] = useState(false);
//   const [walletAddress, setWalletAddress] = useState<string>("");
//   const [userBalance, setUserBalance] = useState<any>(null);
//   const [loadingBalance, setLoadingBalance] = useState(false);

//   useEffect(() => {
//     const address = getWalletAddress();
//     setWalletAddress(address || "");
    
//     // Load user balance if wallet is connected
//     if (address) {
//       loadUserBalance(address);
//     }
//   }, []);

//   // Initialize task states based on user completions
//   useEffect(() => {
//     const states: Record<string, number> = {};
//     tasks.forEach(task => {
//       const completion = userCompletions[task.id];
//       states[task.id] = completion?.completed ? 2 : 0; // 0 = not started, 1 = in progress, 2 = completed
//     });
//     setTaskStates(states);
//   }, [tasks, userCompletions]);

//   // Check if user has already claimed rewards
//   useEffect(() => {
//     if (projectData.claim_status === 'claimed') {
//       setRewardClaimed(true);
//     }
//   }, [projectData.claim_status]);

//   // Calculate if all tasks are completed
//   const allTasksCompleted = tasks.length > 0 && tasks.every(task => taskStates[task.id] === 2);
  
//   // Calculate if rewards can be claimed
//   const canClaimReward = allTasksCompleted && !rewardClaimed && getAuthStatus();

//   const handleTaskAction = async (task: ProjectTask) => {
//     if (!getAuthStatus() || !walletAddress) {
//       console.error('Please connect your wallet to complete tasks');
//       alert('Please connect your wallet to complete tasks');
//       return;
//     }

//     // If task has an action URL, open it first
//     if (task.action_url) {
//       window.open(task.action_url, '_blank');
//     }

//     // Set task as in progress
//     setTaskStates(prev => ({ ...prev, [task.id]: 1 }));
//     setCompletingTask(task.id);

//     try {
//       const result = await optimizedCampaignService.completeTask(
//         walletAddress,
//         projectData.id,
//         task.id,
//         { 
//           timestamp: Date.now(),
//           action_url: task.action_url,
//           type: task.type
//         }
//       );

//       if (result.success) {
//         setTaskStates(prev => ({ ...prev, [task.id]: 2 }));
//         console.log('Task completed successfully!');
//         // toast.success('Task completed successfully!'); // TODO: Implement proper toast
        
//         // Refresh user balance after task completion
//         if (walletAddress) {
//           loadUserBalance(walletAddress);
//         }
        
//         // Notify parent component
//         if (onTaskComplete) {
//           onTaskComplete(task.id);
//         }
//       } else {
//         setTaskStates(prev => ({ ...prev, [task.id]: 0 }));
//         console.error(result.error || 'Failed to complete task');
//         // toast.error(result.error || 'Failed to complete task'); // TODO: Implement proper toast
//       }
//     } catch (error) {
//       setTaskStates(prev => ({ ...prev, [task.id]: 0 }));
//       console.error('Failed to complete task');
//       // toast.error('Failed to complete task'); // TODO: Implement proper toast
//       console.error('❌ Task completion error:', error);
//     } finally {
//       setCompletingTask(null);
//     }
//   };

//   const loadUserBalance = async (address: string) => {
//     try {
//       setLoadingBalance(true);
//       const balance = await optimizedUserService.getUserBalance(address);
//       setUserBalance(balance);
//     } catch (error) {
//       console.error('Error loading user balance:', error);
//       setUserBalance(null);
//     } finally {
//       setLoadingBalance(false);
//     }
//   };

//   const handleClaimRewards = async () => {
//     if (!getAuthStatus() || !walletAddress || !projectData || rewardClaimed || isClaimingReward) {
//       if (rewardClaimed) {
//         console.info('You have already claimed rewards for this campaign.');
//         // toast.info('You have already claimed rewards for this campaign.'); // TODO: Implement proper toast
//       }
//       return;
//     }

//     // Check if all tasks are completed
//     const completedTasks = Object.values(taskStates).filter(state => state === 2).length;
//     const totalTasks = tasks.length;
    
//     if (completedTasks < totalTasks) {
//       console.error('Please complete all tasks before claiming rewards');
//       alert('Please complete all tasks before claiming rewards');
//       return;
//     }

//     setIsClaimingReward(true);

//     try {
//       const result = await campaignRewardsService.claimCampaignReward(walletAddress, {
//         projectId: projectData.id,
//         neftReward: projectData.neftReward || 0,
//         xpReward: projectData.xpReward || 0
//       });

//       if (result.success) {
//         setRewardClaimed(true);
//         console.log('Campaign rewards claimed successfully!');
//         // toast.success('Campaign rewards claimed successfully!'); // TODO: Implement proper toast
        
//         // Refresh user balance after successful claim
//         if (walletAddress) {
//           loadUserBalance(walletAddress);
//         }
        
//         // Notify parent component
//         if (onRewardsClaim) {
//           onRewardsClaim();
//         }
//       } else {
//         console.error(result.message || 'Failed to claim campaign reward');
//         // toast.error(result.error || 'Failed to claim campaign reward'); // TODO: Implement proper toast
//       }
//     } catch (error) {
//       console.error('Failed to claim campaign reward');
//       // toast.error('Failed to claim campaign reward'); // TODO: Implement proper toast
//       console.error('❌ Reward claim error:', error);
//     } finally {
//       setIsClaimingReward(false);
//     }
//   };

//   const getTaskIcon = (type: string) => {
//     switch (type) {
//       case 'twitter_follow': return Twitter;
//       case 'twitter_retweet': return Repeat;
//       case 'twitter_post': return Edit;
//       case 'discord_join': return MessageCircle;
//       case 'discord_role': return UserPlus;
//       case 'telegram_join': return Send;
//       case 'visit_website': return Globe;
//       case 'quiz': return HelpCircle;
//       default: return Target;
//     }
//   };

//   const getTaskButtonText = (task: ProjectTask, state: number) => {
//     if (state === 2) return "Completed";
//     if (state === 1) return "Completing...";
    
//     switch (task.type) {
//       case 'twitter_follow': return "Follow on Twitter";
//       case 'twitter_retweet': return "Retweet Post";
//       case 'twitter_post': return "Create Tweet";
//       case 'discord_join': return "Join Discord";
//       case 'discord_role': return "Get Discord Role";
//       case 'telegram_join': return "Join Telegram";
//       case 'visit_website': return "Visit Website";
//       case 'quiz': return "Take Quiz";
//       default: return "Complete Task";
//     }
//   };

//   const getTaskButtonIcon = (task: ProjectTask, state: number) => {
//     if (state === 2) return CheckCircle;
//     if (state === 1) return Loader2;
    
//     const Icon = getTaskIcon(task.type);
//     return Icon;
//   };

//   const completedTasks = Object.values(taskStates).filter(state => state === 2).length;
//   const totalTasks = tasks.length;
//   const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
//   const allTasksComplete = completedTasks === totalTasks && totalTasks > 0;

//   return (
//     <div className="space-y-6">
//       {/* User Balance Overview */}
//       {walletAddress && userBalance && (
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="bg-gradient-to-r from-[#38B2AC]/10 to-[#5D43EF]/10 border border-[#38B2AC]/20 rounded-xl p-6 mb-6"
//         >
//           <div className="flex items-center justify-between mb-4">
//             <h3 className="text-lg font-semibold text-white">Your Current Balance</h3>
//             <button
//               onClick={() => loadUserBalance(walletAddress)}
//               disabled={loadingBalance}
//               className="text-xs text-[#38B2AC] hover:text-white transition-colors"
//             >
//               {loadingBalance ? 'Refreshing...' : 'Refresh'}
//             </button>
//           </div>
          
//           <div className="grid grid-cols-3 gap-4">
//             <div className="text-center">
//               <div className="w-10 h-10 rounded-full bg-[#38B2AC]/20 flex items-center justify-center mx-auto mb-2">
//                 <Coins className="w-5 h-5 text-[#38B2AC]" />
//               </div>
//               <p className="text-xs text-gray-400">NEFT Balance</p>
//               <p className="text-sm font-semibold text-white">{userBalance.neft_balance || 0}</p>
//             </div>
            
//             <div className="text-center">
//               <div className="w-10 h-10 rounded-full bg-[#805AD5]/20 flex items-center justify-center mx-auto mb-2">
//                 <Zap className="w-5 h-5 text-[#805AD5]" />
//               </div>
//               <p className="text-xs text-gray-400">XP Balance</p>
//               <p className="text-sm font-semibold text-white">{userBalance.xp_balance || 0}</p>
//             </div>
            
//             <div className="text-center">
//               <div className="w-10 h-10 rounded-full bg-[#F6AD55]/20 flex items-center justify-center mx-auto mb-2">
//                 <Trophy className="w-5 h-5 text-[#F6AD55]" />
//               </div>
//               <p className="text-xs text-gray-400">Staked</p>
//               <p className="text-sm font-semibold text-white">{userBalance.staked_amount || 0}</p>
//             </div>
//           </div>
//         </motion.div>
//       )}

//       {/* Progress Overview */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: walletAddress && userBalance ? 0.1 : 0 }}
//         className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//       >
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-lg font-semibold text-white">Task Progress</h3>
//           <div className="text-sm text-gray-400">
//             {completedTasks}/{totalTasks} completed ({Math.round(completionPercentage)}%)
//           </div>
//         </div>

//         {/* Progress Bar */}
//         <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
//           <div
//             className="bg-gradient-to-r from-[#5D43EF] to-[#38B2AC] h-3 rounded-full transition-all duration-500"
//             style={{ width: `${completionPercentage}%` }}
//           />
//         </div>

//         {/* Rewards Preview */}
//         <div className="grid grid-cols-2 gap-4">
//           <div className="flex items-center gap-3 p-3 bg-[#252030] rounded-lg">
//             <div className="w-8 h-8 rounded-full bg-[#38B2AC]/20 flex items-center justify-center">
//               <Coins className="w-4 h-4 text-[#38B2AC]" />
//             </div>
//             <div>
//               <p className="text-xs text-gray-400">NEFT Reward</p>
//               <p className="text-sm font-semibold text-white">{projectData.neftReward}</p>
//             </div>
//           </div>
          
//           <div className="flex items-center gap-3 p-3 bg-[#252030] rounded-lg">
//             <div className="w-8 h-8 rounded-full bg-[#805AD5]/20 flex items-center justify-center">
//               <Zap className="w-4 h-4 text-[#805AD5]" />
//             </div>
//             <div>
//               <p className="text-xs text-gray-400">XP Reward</p>
//               <p className="text-sm font-semibold text-white">{projectData.xpReward}</p>
//             </div>
//           </div>
//         </div>
//       </motion.div>

//       {/* Tasks List */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: walletAddress && userBalance ? 0.2 : 0.1 }}
//         className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//       >
//         <h3 className="text-lg font-semibold text-white mb-4">Campaign Tasks</h3>
        
//         <div className="space-y-4">
//           {tasks
//             .sort((a, b) => a.sort_order - b.sort_order)
//             .map((task, index) => {
//               const TaskIcon = getTaskButtonIcon(task, taskStates[task.id] || 0);
//               const isCompleted = taskStates[task.id] === 2;
//               const isLoading = taskStates[task.id] === 1 || completingTask === task.id;

//               return (
//                 <motion.div
//                   key={task.id}
//                   initial={{ opacity: 0, x: -20 }}
//                   animate={{ opacity: 1, x: 0 }}
//                   transition={{ duration: 0.4, delay: index * 0.1 }}
//                   className={cn(
//                     "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200",
//                     isCompleted
//                       ? "bg-green-500/10 border-green-500/30"
//                       : "bg-[#252030] border-gray-600 hover:border-gray-500"
//                   )}
//                 >
//                   {/* Task Icon */}
//                   <div className={cn(
//                     "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
//                     isCompleted ? "bg-green-500/20" : "bg-[#5D43EF]/20"
//                   )}>
//                     <TaskIcon className={cn(
//                       "w-5 h-5",
//                       isCompleted ? "text-green-400" : "text-[#5D43EF]",
//                       isLoading && "animate-spin"
//                     )} />
//                   </div>

//                   {/* Task Content */}
//                   <div className="flex-1">
//                     <h4 className="font-medium text-white mb-1">{task.title}</h4>
//                     <p className="text-sm text-gray-400">{task.description}</p>
//                     {task.action_url && (
//                       <div className="flex items-center gap-1 mt-2 text-xs text-[#5D43EF]">
//                         <ExternalLink className="w-3 h-3" />
//                         <span>Opens external link</span>
//                       </div>
//                     )}
//                   </div>

//                   {/* Task Button */}
//                   <button
//                     onClick={() => handleTaskAction(task)}
//                     disabled={!getAuthStatus() || isCompleted}
//                     className={cn(
//                       "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 min-w-[140px] justify-center",
//                       isCompleted
//                         ? "bg-green-500/20 text-green-400 cursor-default"
//                         : isLoading
//                         ? "bg-gray-600 text-gray-300 cursor-not-allowed"
//                         : !task.is_active
//                         ? "bg-gray-700 text-gray-500 cursor-not-allowed"
//                         : "bg-[#5D43EF] text-white hover:bg-[#4C38C2] hover:shadow-lg hover:shadow-[#5D43EF]/20"
//                     )}
//                   >
//                     <TaskIcon className={cn(
//                       "w-4 h-4",
//                       isLoading && "animate-spin"
//                     )} />
//                     {getTaskButtonText(task, taskStates[task.id] || 0)}
//                   </button>
//                 </motion.div>
//               );
//             })}
//         </div>
//       </motion.div>

//       {/* Claim Rewards Section */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: walletAddress && userBalance ? 0.3 : 0.2 }}
//         className="bg-gradient-to-r from-[#5D43EF]/10 to-[#38B2AC]/10 border border-[#5D43EF]/20 rounded-xl p-6"
//       >
//         <div className="flex items-center gap-4 mb-4">
//           <div className="w-12 h-12 rounded-full bg-[#5D43EF]/20 flex items-center justify-center">
//             <Gift className="w-6 h-6 text-[#5D43EF]" />
//           </div>
//           <div>
//             <h3 className="text-lg font-semibold text-white">Claim Your Rewards</h3>
//             <p className="text-sm text-gray-400">
//               {canClaimReward 
//                 ? "All tasks completed! Claim your rewards now." 
//                 : `Complete ${totalTasks - completedTasks} more task${totalTasks - completedTasks !== 1 ? 's' : ''} to unlock rewards.`
//               }
//             </p>
//           </div>
//         </div>

//         {/* Rewards Summary */}
//         <div className="grid grid-cols-2 gap-4 mb-6">
//           <div className="bg-[#1A1625] p-4 rounded-lg">
//             <div className="flex items-center gap-2 mb-2">
//               <Coins className="w-5 h-5 text-[#38B2AC]" />
//               <span className="text-sm text-gray-400">NEFT Tokens</span>
//             </div>
//             <span className="text-xl font-bold text-white">{projectData.neftReward}</span>
//           </div>
          
//           <div className="bg-[#1A1625] p-4 rounded-lg">
//             <div className="flex items-center gap-2 mb-2">
//               <Zap className="w-5 h-5 text-[#805AD5]" />
//               <span className="text-sm text-gray-400">Experience Points</span>
//             </div>
//             <span className="text-xl font-bold text-white">{projectData.xpReward} XP</span>
//           </div>
//         </div>

//         {/* Claim Button */}
//         <button
//           onClick={handleClaimRewards}
//           disabled={!getAuthStatus() || rewardClaimed || !allTasksCompleted}
//           className={cn(
//             "w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2",
//             rewardClaimed
//               ? "bg-green-500/20 text-green-400 cursor-default"
//               : canClaimReward && getAuthStatus()
//               ? "bg-gradient-to-r from-[#5D43EF] to-[#38B2AC] text-white hover:shadow-lg hover:shadow-[#5D43EF]/20 hover:scale-[1.02]"
//               : "bg-gray-700 text-gray-400 cursor-not-allowed"
//           )}
//         >
//           {isClaimingReward ? (
//             <>
//               <Loader2 className="w-5 h-5 animate-spin" />
//               Claiming Rewards...
//             </>
//           ) : rewardClaimed ? (
//             <>
//               <CheckCircle className="w-5 h-5" />
//               Rewards Claimed
//             </>
//           ) : canClaimReward ? (
//             <>
//               <Award className="w-5 h-5" />
//               Claim Rewards
//             </>
//           ) : !getAuthStatus() ? (
//             <>
//               <Shield className="w-5 h-5" />
//               Connect Wallet
//             </>
//           ) : (
//             <>
//               <Clock className="w-5 h-5" />
//               Complete All Tasks First
//             </>
//           )}
//         </button>

//         {/* Additional Info */}
//         {!getAuthStatus() && (
//           <p className="text-xs text-gray-500 text-center mt-3">
//             Connect your wallet to complete tasks and claim rewards
//           </p>
//         )}
        
//         {getAuthStatus() && !rewardClaimed && canClaimReward && (
//           <p className="text-xs text-green-400 text-center mt-3">
//             🎉 Congratulations! You've completed all tasks and can now claim your rewards.
//           </p>
//         )}
//       </motion.div>

//       {/* Campaign Stats */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: walletAddress && userBalance ? 0.4 : 0.3 }}
//         className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//       >
//         <h3 className="text-lg font-semibold text-white mb-4">Campaign Stats</h3>
        
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="text-center">
//             <div className="w-10 h-10 rounded-full bg-[#F6AD55]/20 flex items-center justify-center mx-auto mb-2">
//               <Users className="w-5 h-5 text-[#F6AD55]" />
//             </div>
//             <p className="text-sm text-gray-400">Participants</p>
//             <p className="text-lg font-semibold text-white">{projectData.participantsCount.toLocaleString()}</p>
//           </div>
          
//           <div className="text-center">
//             <div className="w-10 h-10 rounded-full bg-[#38B2AC]/20 flex items-center justify-center mx-auto mb-2">
//               <Award className="w-5 h-5 text-[#38B2AC]" />
//             </div>
//             <p className="text-sm text-gray-400">Total Supply</p>
//             <p className="text-lg font-semibold text-white">{projectData.totalSupply.toLocaleString()}</p>
//           </div>
          
//           <div className="text-center">
//             <div className="w-10 h-10 rounded-full bg-[#F56565]/20 flex items-center justify-center mx-auto mb-2">
//               <Clock className="w-5 h-5 text-[#F56565]" />
//             </div>
//             <p className="text-sm text-gray-400">Time Left</p>
//             <p className="text-lg font-semibold text-white">{projectData.timeLeft}</p>
//           </div>
          
//           <div className="text-center">
//             <div className="w-10 h-10 rounded-full bg-[#805AD5]/20 flex items-center justify-center mx-auto mb-2">
//               <TrendingUp className="w-5 h-5 text-[#805AD5]" />
//             </div>
//             <p className="text-sm text-gray-400">Category</p>
//             <p className="text-lg font-semibold text-white">{projectData.category}</p>
//           </div>
//         </div>
//       </motion.div>

//       {/* Service Integration Info */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ delay: walletAddress && userBalance ? 0.5 : 0.4 }}
//         className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//       >
//         <h3 className="text-lg font-semibold text-white mb-4">Integration Status</h3>
        
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <div className="text-center p-3 bg-[#252030] rounded-lg">
//             <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
//               <CheckCircle className="w-4 h-4 text-green-400" />
//             </div>
//             <p className="text-xs text-gray-400">Campaign Service</p>
//             <p className="text-sm font-semibold text-green-400">Connected</p>
//           </div>
          
//           <div className="text-center p-3 bg-[#252030] rounded-lg">
//             <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
//               <CheckCircle className="w-4 h-4 text-green-400" />
//             </div>
//             <p className="text-xs text-gray-400">User Service</p>
//             <p className="text-sm font-semibold text-green-400">Connected</p>
//           </div>
          
//           <div className="text-center p-3 bg-[#252030] rounded-lg">
//             <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
//               <CheckCircle className="w-4 h-4 text-green-400" />
//             </div>
//             <p className="text-xs text-gray-400">Rewards Service</p>
//             <p className="text-sm font-semibold text-green-400">Connected</p>
//           </div>
//         </div>
        
//         <div className="mt-4 p-3 bg-[#252030] rounded-lg">
//           <div className="flex items-center gap-2 mb-2">
//             <TrendingUp className="w-4 h-4 text-[#5D43EF]" />
//             <span className="text-sm font-medium text-white">Optimized Performance</span>
//           </div>
//           <p className="text-xs text-gray-400">
//             Using cached data and optimized RPC functions for improved performance and reduced database load.
//           </p>
//         </div>
//       </motion.div>
//     </div>
//   );
// };

// export default OptimizedNFTTaskList;
