// import React, { useState, useEffect } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { MainNav } from "@/components/layout/MainNav";
// import { motion } from "framer-motion";
// import {
//   ArrowLeft,
//   Clock,
//   Users,
//   Trophy,
//   Coins,
//   Zap,
//   Star,
//   ExternalLink,
//   Twitter,
//   MessageCircle,
//   Globe,
//   CheckCircle,
//   Circle,
//   Play,
//   Award,
//   Target,
//   TrendingUp,
//   Calendar,
//   MapPin,
//   Shield,
//   Flame,
//   Repeat,
//   Edit,
//   UserPlus,
//   Send,
//   HelpCircle,
//   Eye,
//   Gift,
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { toast } from "react-hot-toast";
// import optimizedCampaignService, { ProjectDetails, ProjectTask, UserTaskCompletion } from "@/services/OptimizedCampaignService";
// import optimizedUserService from "@/services/OptimizedUserService";
// import { getWalletAddress, getAuthStatus } from "@/utils/authUtils";

// interface NFTProject {
//   id: string;
//   projectName: string;
//   nftName: string;
//   description: string;
//   imageUrl: string;
//   bannerUrl?: string;
//   neftReward: number;
//   xpReward: number;
//   totalSupply: number;
//   participantsCount: number;
//   maxParticipants?: number;
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

// // Remove local Task interface - using ProjectTask from service instead

// const OptimizedProjectDetails = () => {
//   const { id } = useParams<{ id: string }>();
//   const navigate = useNavigate();
//   const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [error, setError] = useState<string | null>(null);
//   const [taskStates, setTaskStates] = useState<Record<string, number>>({});
//   const [completingTask, setCompletingTask] = useState<string | null>(null);
//   const [walletAddress, setWalletAddress] = useState<string>("");
//   const [userStats, setUserStats] = useState<any>(null);
//   const [loadingUserStats, setLoadingUserStats] = useState<boolean>(false);

//   useEffect(() => {
//     const address = getWalletAddress();
//     setWalletAddress(address || "");
    
//     // Load user stats if wallet is connected
//     if (address) {
//       loadUserStats(address);
//     }
//   }, []);

//   useEffect(() => {
//     if (id) {
//       loadProjectDetails(id);
//     }
//   }, [id, walletAddress]);

//   const loadProjectDetails = async (projectId: string) => {
//     try {
//       setLoading(true);
//       setError(null);
      
//       const details = await optimizedCampaignService.getProjectDetails(
//         projectId,
//         walletAddress || undefined
//       );
      
//       setProjectDetails(details);
      
//       // Initialize task states based on user completions
//       const states: Record<string, number> = {};
//       details.tasks.forEach(task => {
//         const completion = details.user_completions[task.id];
//         states[task.id] = completion?.completed ? 2 : 0; // 0 = not started, 2 = completed
//       });
//       setTaskStates(states);
      
//       console.log(`✅ Loaded project details for ${projectId}`);
//     } catch (err) {
//       console.error('❌ Error loading project details:', err);
//       setError(err instanceof Error ? err.message : 'Failed to load project details');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadUserStats = async (address: string) => {
//     try {
//       setLoadingUserStats(true);
//       const stats = await optimizedCampaignService.getUserProjectStats(address);
//       setUserStats(stats);
//       console.log(`✅ Loaded user stats for ${address}`);
//     } catch (err) {
//       console.error('❌ Error loading user stats:', err);
//       setUserStats(null);
//     } finally {
//       setLoadingUserStats(false);
//     }
//   };

//   const handleTaskAction = async (task: ProjectTask) => {
//     if (!getAuthStatus() || !walletAddress) {
//       toast.error('Please connect your wallet to complete tasks');
//       return;
//     }

//     if (!projectDetails) return;

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
//         projectDetails.project.id,
//         task.id,
//         { timestamp: Date.now() }
//       );

//       if (result.success) {
//         setTaskStates(prev => ({ ...prev, [task.id]: 2 }));
//         toast.success('Task completed successfully!');
        
//         // Update project details with new completion data
//         if (result.completed_tasks_count !== undefined) {
//           setProjectDetails(prev => prev ? {
//             ...prev,
//             user_participation: prev.user_participation ? {
//               ...prev.user_participation,
//               completed_tasks_count: result.completed_tasks_count!,
//               completion_percentage: result.completion_percentage || 0
//             } : undefined,
//             user_completions: {
//               ...prev.user_completions,
//               [task.id]: {
//                 completed: true,
//                 completed_at: new Date().toISOString()
//               }
//             }
//           } : prev);
//         }
        
//         // Refresh user stats after task completion
//         if (walletAddress) {
//           loadUserStats(walletAddress);
//         }
//       } else {
//         setTaskStates(prev => ({ ...prev, [task.id]: 0 }));
//         toast.error(result.error || 'Failed to complete task');
//       }
//     } catch (error) {
//       setTaskStates(prev => ({ ...prev, [task.id]: 0 }));
//       toast.error('Failed to complete task');
//       console.error('❌ Task completion error:', error);
//     } finally {
//       setCompletingTask(null);
//     }
//   };

//   const mapProjectToNFTProject = (details: ProjectDetails): NFTProject => {
//     const project = details.project;
//     return {
//       id: project.id,
//       projectName: project.title,
//       nftName: project.collection_name,
//       description: project.description || '',
//       imageUrl: project.image_url || '',
//       bannerUrl: project.banner_url,
//       neftReward: project.reward_amount,
//       xpReward: project.xp_reward,
//       totalSupply: project.total_supply || 0,
//       participantsCount: project.current_participants || 0,
//       maxParticipants: project.max_participants,
//       timeLeft: formatTimeRemaining(project.seconds_remaining || 0),
//       category: project.category,
//       blockchain: project.blockchain || 'Ethereum',
//       website: project.website,
//       twitter: project.twitter,
//       discord: project.discord,
//       rarityDistribution: project.rarity_distribution || {
//         common: 70,
//         rare: 25,
//         legendary: 5
//       },
//       tasks: details.tasks.map(task => ({
//         id: task.id,
//         title: task.title,
//         description: task.description || '',
//         type: task.type,
//         action_url: task.action_url,
//         discord_user_id: task.discord_user_id,
//         discord_guild_id: task.discord_guild_id,
//         required_role_id: task.required_role_id,
//         telegram_channel_id: task.telegram_channel_id,
//         website_url: task.website_url,
//         quiz_questions: task.quiz_questions,
//         quiz_passing_score: task.quiz_passing_score,
//         twitter_username: task.twitter_username,
//         twitter_tweet_id: task.twitter_tweet_id,
//         is_active: task.is_active,
//         sort_order: task.sort_order
//       })),
//       status: project.status || 'active',
//       endDate: project.end_date,
//       level_requirement: project.level_requirement,
//       usd_value: project.usd_value,
//       claim_status: project.claim_status,
//       task_status: project.task_status
//     };
//   };

//   const formatTimeRemaining = (seconds: number): string => {
//     if (seconds <= 0) return "Campaign Ended";
    
//     const days = Math.floor(seconds / (24 * 3600));
//     const hours = Math.floor((seconds % (24 * 3600)) / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
    
//     if (days > 0) return `${days} days, ${hours} hours left`;
//     if (hours > 0) return `${hours} hours, ${minutes} minutes left`;
//     return `${minutes} minutes left`;
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
//     if (state === 1) return Play;
    
//     const Icon = getTaskIcon(task.type);
//     return Icon;
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-[#0B0A14] via-[#1a1625] to-[#0B0A14]">
//         <MainNav />
//         <main className="container mx-auto px-4 pt-24">
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             className="text-center py-12"
//           >
//             <div className="inline-flex items-center gap-3 text-gray-400">
//               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5D43EF]"></div>
//               <span className="text-lg">Loading campaign details...</span>
//             </div>
//           </motion.div>
//         </main>
//       </div>
//     );
//   }

//   if (error || !projectDetails) {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-[#0B0A14] via-[#1a1625] to-[#0B0A14]">
//         <MainNav />
//         <main className="container mx-auto px-4 pt-24">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="text-center py-12"
//           >
//             <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8 max-w-md mx-auto">
//               <p className="text-red-400 text-lg mb-4">{error || 'Campaign not found'}</p>
//               <div className="flex gap-3 justify-center">
//                 <button
//                   onClick={() => navigate('/discover')}
//                   className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
//                 >
//                   Back to Discover
//                 </button>
//                 <button
//                   onClick={() => id && loadProjectDetails(id)}
//                   className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
//                 >
//                   Try Again
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         </main>
//       </div>
//     );
//   }

//   const nftProject = mapProjectToNFTProject(projectDetails);
//   const completedTasks = Object.values(taskStates).filter(state => state === 2).length;
//   const totalTasks = nftProject.tasks.length;
//   const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-[#0B0A14] via-[#1a1625] to-[#0B0A14]">
//       <MainNav />
      
//       <main className="container mx-auto px-4 pt-24 pb-12">
//         {/* Back Button */}
//         <motion.button
//           initial={{ opacity: 0, x: -20 }}
//           animate={{ opacity: 1, x: 0 }}
//           onClick={() => navigate('/discover')}
//           className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
//         >
//           <ArrowLeft className="w-4 h-4" />
//           Back to Discover
//         </motion.button>

//         {/* Hero Section */}
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.6 }}
//           className="relative rounded-2xl overflow-hidden mb-8"
//         >
//           {/* Banner Image */}
//           <div className="h-64 md:h-80 bg-gradient-to-br from-[#5D43EF]/20 to-[#38B2AC]/20 relative">
//             {nftProject.bannerUrl ? (
//               <img
//                 src={nftProject.bannerUrl}
//                 alt={nftProject.projectName}
//                 className="w-full h-full object-cover"
//               />
//             ) : (
//               <div className="w-full h-full flex items-center justify-center">
//                 <div className="w-24 h-24 bg-[#5D43EF]/20 rounded-full flex items-center justify-center">
//                   <Trophy className="w-12 h-12 text-[#5D43EF]" />
//                 </div>
//               </div>
//             )}
            
//             {/* Overlay */}
//             <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A14] via-transparent to-transparent" />
            
//             {/* Status Badge */}
//             <div className="absolute top-6 left-6">
//               <span className={cn(
//                 "px-3 py-1 rounded-full text-sm font-medium",
//                 nftProject.status === 'active' ? "bg-green-500/20 text-green-400 border border-green-500/30" :
//                 nftProject.status === 'ended' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
//                 "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
//               )}>
//                 {nftProject.status === 'active' ? 'Live Campaign' : 
//                  nftProject.status === 'ended' ? 'Campaign Ended' : 'Coming Soon'}
//               </span>
//             </div>
//           </div>

//           {/* Project Info */}
//           <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0B0A14] to-transparent">
//             <div className="flex items-end gap-6">
//               {/* Project Avatar */}
//               <div className="w-20 h-20 rounded-xl bg-[#1A1625] border-2 border-gray-700 overflow-hidden flex-shrink-0">
//                 {nftProject.imageUrl ? (
//                   <img
//                     src={nftProject.imageUrl}
//                     alt={nftProject.nftName}
//                     className="w-full h-full object-cover"
//                   />
//                 ) : (
//                   <div className="w-full h-full flex items-center justify-center">
//                     <Award className="w-8 h-8 text-[#5D43EF]" />
//                   </div>
//                 )}
//               </div>

//               {/* Project Details */}
//               <div className="flex-1">
//                 <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
//                   {nftProject.projectName}
//                 </h1>
//                 <p className="text-xl text-gray-300 mb-2">{nftProject.nftName}</p>
//                 <div className="flex items-center gap-4 text-sm text-gray-400">
//                   <span className="flex items-center gap-1">
//                     <MapPin className="w-4 h-4" />
//                     {nftProject.blockchain}
//                   </span>
//                   <span className="flex items-center gap-1">
//                     <Users className="w-4 h-4" />
//                     {nftProject.participantsCount} participants
//                   </span>
//                   <span className="flex items-center gap-1">
//                     <Clock className="w-4 h-4" />
//                     {nftProject.timeLeft}
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </motion.div>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           {/* Main Content */}
//           <div className="lg:col-span-2 space-y-8">
//             {/* Description */}
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.6, delay: 0.1 }}
//               className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//             >
//               <h2 className="text-xl font-semibold text-white mb-4">About This Campaign</h2>
//               <p className="text-gray-300 leading-relaxed">
//                 {nftProject.description || 'Complete the tasks below to earn rewards and claim your NFT from this exclusive campaign.'}
//               </p>
//             </motion.div>

//             {/* Tasks Section */}
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.6, delay: 0.2 }}
//               className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//             >
//               <div className="flex items-center justify-between mb-6">
//                 <h2 className="text-xl font-semibold text-white">Campaign Tasks</h2>
//                 <div className="text-sm text-gray-400">
//                   {completedTasks}/{totalTasks} completed ({Math.round(completionPercentage)}%)
//                 </div>
//               </div>

//               {/* Progress Bar */}
//               <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
//                 <div
//                   className="bg-gradient-to-r from-[#5D43EF] to-[#38B2AC] h-2 rounded-full transition-all duration-500"
//                   style={{ width: `${completionPercentage}%` }}
//                 />
//               </div>

//               {/* Tasks List */}
//               <div className="space-y-4">
//                 {nftProject.tasks
//                   .sort((a, b) => a.sort_order - b.sort_order)
//                   .map((task, index) => {
//                     const TaskIcon = getTaskButtonIcon(task, taskStates[task.id] || 0);
//                     const isCompleted = taskStates[task.id] === 2;
//                     const isLoading = taskStates[task.id] === 1;

//                     return (
//                       <motion.div
//                         key={task.id}
//                         initial={{ opacity: 0, x: -20 }}
//                         animate={{ opacity: 1, x: 0 }}
//                         transition={{ duration: 0.4, delay: index * 0.1 }}
//                         className={cn(
//                           "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200",
//                           isCompleted
//                             ? "bg-green-500/10 border-green-500/30"
//                             : "bg-[#252030] border-gray-600 hover:border-gray-500"
//                         )}
//                       >
//                         <div className={cn(
//                           "w-10 h-10 rounded-full flex items-center justify-center",
//                           isCompleted ? "bg-green-500/20" : "bg-[#5D43EF]/20"
//                         )}>
//                           <TaskIcon className={cn(
//                             "w-5 h-5",
//                             isCompleted ? "text-green-400" : "text-[#5D43EF]"
//                           )} />
//                         </div>

//                         <div className="flex-1">
//                           <h3 className="font-medium text-white mb-1">{task.title}</h3>
//                           <p className="text-sm text-gray-400">{task.description}</p>
//                         </div>

//                         <button
//                           onClick={() => handleTaskAction(task)}
//                           disabled={isCompleted || isLoading || !task.is_active}
//                           className={cn(
//                             "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2",
//                             isCompleted
//                               ? "bg-green-500/20 text-green-400 cursor-default"
//                               : isLoading
//                               ? "bg-gray-600 text-gray-300 cursor-not-allowed"
//                               : "bg-[#5D43EF] text-white hover:bg-[#4C38C2] hover:shadow-lg hover:shadow-[#5D43EF]/20"
//                           )}
//                         >
//                           <TaskIcon className="w-4 h-4" />
//                           {getTaskButtonText(task, taskStates[task.id] || 0)}
//                         </button>
//                       </motion.div>
//                     );
//                   })}
//               </div>
//             </motion.div>
//           </div>

//           {/* Sidebar */}
//           <div className="space-y-6">
//             {/* Rewards Card */}
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.6, delay: 0.3 }}
//               className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//             >
//               <h3 className="text-lg font-semibold text-white mb-4">Campaign Rewards</h3>
              
//               <div className="space-y-4">
//                 <div className="flex items-center justify-between p-3 bg-[#252030] rounded-lg">
//                   <div className="flex items-center gap-3">
//                     <div className="w-8 h-8 rounded-full bg-[#38B2AC]/20 flex items-center justify-center">
//                       <Coins className="w-4 h-4 text-[#38B2AC]" />
//                     </div>
//                     <span className="text-gray-300">NEFT Tokens</span>
//                   </div>
//                   <span className="font-semibold text-white">{nftProject.neftReward}</span>
//                 </div>

//                 <div className="flex items-center justify-between p-3 bg-[#252030] rounded-lg">
//                   <div className="flex items-center gap-3">
//                     <div className="w-8 h-8 rounded-full bg-[#805AD5]/20 flex items-center justify-center">
//                       <Zap className="w-4 h-4 text-[#805AD5]" />
//                     </div>
//                     <span className="text-gray-300">Experience</span>
//                   </div>
//                   <span className="font-semibold text-white">{nftProject.xpReward} XP</span>
//                 </div>

//                 {nftProject.usd_value && (
//                   <div className="flex items-center justify-between p-3 bg-[#252030] rounded-lg">
//                     <div className="flex items-center gap-3">
//                       <div className="w-8 h-8 rounded-full bg-[#F6AD55]/20 flex items-center justify-center">
//                         <Gift className="w-4 h-4 text-[#F6AD55]" />
//                       </div>
//                       <span className="text-gray-300">Est. Value</span>
//                     </div>
//                     <span className="font-semibold text-white">${nftProject.usd_value}</span>
//                   </div>
//                 )}
//               </div>
//             </motion.div>

//             {/* Campaign Stats */}
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.6, delay: 0.4 }}
//               className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//             >
//               <h3 className="text-lg font-semibold text-white mb-4">Campaign Stats</h3>
              
//               <div className="space-y-4">
//                 <div className="flex items-center justify-between">
//                   <span className="text-gray-400">Total Supply</span>
//                   <span className="text-white font-medium">{nftProject.totalSupply.toLocaleString()}</span>
//                 </div>
                
//                 <div className="flex items-center justify-between">
//                   <span className="text-gray-400">Participants</span>
//                   <span className="text-white font-medium">
//                     {nftProject.participantsCount.toLocaleString()}
//                     {nftProject.maxParticipants && `/${nftProject.maxParticipants.toLocaleString()}`}
//                   </span>
//                 </div>
                
//                 <div className="flex items-center justify-between">
//                   <span className="text-gray-400">Category</span>
//                   <span className="text-white font-medium">{nftProject.category}</span>
//                 </div>
                
//                 <div className="flex items-center justify-between">
//                   <span className="text-gray-400">Blockchain</span>
//                   <span className="text-white font-medium">{nftProject.blockchain}</span>
//                 </div>
//               </div>
//             </motion.div>

//             {/* User Progress Stats */}

//             {/* Social Links */}
//             {(nftProject.website || nftProject.twitter || nftProject.discord) && (
//               <motion.div
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.6, delay: 0.6 }}
//                 className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//               >
//                 <h3 className="text-lg font-semibold text-white mb-4">Project Links</h3>
                
//                 <div className="space-y-3">
//                   {nftProject.website && (
//                     <a
//                       href={nftProject.website}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="flex items-center gap-3 p-3 bg-[#252030] rounded-lg hover:bg-[#2A2635] transition-colors"
//                     >
//                       <Globe className="w-5 h-5 text-[#5D43EF]" />
//                       <span className="text-white">Website</span>
//                       <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
//                     </a>
//                   )}
                  
//                   {nftProject.twitter && (
//                     <a
//                       href={nftProject.twitter}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="flex items-center gap-3 p-3 bg-[#252030] rounded-lg hover:bg-[#2A2635] transition-colors"
//                     >
//                       <Twitter className="w-5 h-5 text-[#1DA1F2]" />
//                       <span className="text-white">Twitter</span>
//                       <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
//                     </a>
//                   )}
                  
//                   {nftProject.discord && (
//                     <a
//                       href={nftProject.discord}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="flex items-center gap-3 p-3 bg-[#252030] rounded-lg hover:bg-[#2A2635] transition-colors"
//                     >
//                       <MessageCircle className="w-5 h-5 text-[#7289DA]" />
//                       <span className="text-white">Discord</span>
//                       <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
//                     </a>
//                   )}
//                 </div>
//               </motion.div>
//             )}

//             {/* Quick Actions */}
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.6, delay: 0.7 }}
//               className="bg-[#1A1625] border border-gray-700 rounded-xl p-6"
//             >
//               <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              
//               <div className="space-y-3">
//                 <button
//                   onClick={() => optimizedCampaignService.clearCache(`project_${id}`)}
//                   className="w-full flex items-center gap-3 p-3 bg-[#252030] rounded-lg hover:bg-[#2A2635] transition-colors text-left"
//                 >
//                   <div className="w-8 h-8 rounded-full bg-[#5D43EF]/20 flex items-center justify-center">
//                     <TrendingUp className="w-4 h-4 text-[#5D43EF]" />
//                   </div>
//                   <div>
//                     <span className="text-white font-medium">Refresh Data</span>
//                     <p className="text-xs text-gray-400">Clear cache and reload</p>
//                   </div>
//                 </button>
                
//                 {walletAddress && (
//                   <button
//                     onClick={() => navigate('/discover')}
//                     className="w-full flex items-center gap-3 p-3 bg-[#252030] rounded-lg hover:bg-[#2A2635] transition-colors text-left"
//                   >
//                     <div className="w-8 h-8 rounded-full bg-[#38B2AC]/20 flex items-center justify-center">
//                       <Eye className="w-4 h-4 text-[#38B2AC]" />
//                     </div>
//                     <div>
//                       <span className="text-white font-medium">Explore More</span>
//                       <p className="text-xs text-gray-400">Find similar campaigns</p>
//                     </div>
//                   </button>
//                 )}
//               </div>
//             </motion.div>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default OptimizedProjectDetails;
