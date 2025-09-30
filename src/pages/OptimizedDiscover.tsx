// import React, { useState, useEffect, useCallback } from "react";
// import { MainNav } from "@/components/layout/MainNav";
// import { motion } from "framer-motion";
// import {
//   Search,
//   Sparkles,
//   Clock,
//   Trophy,
//   Coins,
//   Users,
//   ChevronRight,
//   ArrowRight,
//   Star,
//   Timer,
//   Flame,
//   TrendingUp,
//   Zap,
//   SlidersHorizontal,
//   Sliders,
//   Eye,
//   Heart,
//   Share2,
//   Play,
//   Award,
//   Target,
//   Rocket,
// } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// import { cn } from "@/lib/utils";
// import styles from "./Discover.module.css";
// import optimizedCampaignService, { Project, ProjectsDashboard } from "@/services/OptimizedCampaignService";
// import { getWalletAddress } from "@/utils/authUtils";

// const OptimizedDiscover = () => {
//   const [activeCategory, setActiveCategory] = useState<string>("all");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [isSearchFocused, setIsSearchFocused] = useState(false);
//   const [viewMode, setViewMode] = useState("grid");
//   const [dashboard, setDashboard] = useState<ProjectsDashboard | null>(null);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [error, setError] = useState<string | null>(null);
//   const navigate = useNavigate();
//   const searchInputRef = React.useRef<HTMLInputElement>(null);

//   // Debounced search to reduce API calls
//   const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

//   const loadProjects = useCallback(async (category: string, search: string) => {
//     try {
//       setLoading(true);
//       setError(null);
      
//       const result = await optimizedCampaignService.getProjectsDashboard(
//         category,
//         search,
//         50, // limit
//         0   // offset
//       );
      
//       setDashboard(result);
//       console.log(`📊 Loaded ${result.projects.length} projects`);
//     } catch (err) {
//       console.error('❌ Error loading projects:', err);
//       setError(err instanceof Error ? err.message : 'Failed to load projects');
//       setDashboard(null);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // Initial load and preloading
//   useEffect(() => {
//     // Preload popular projects in background
//     optimizedCampaignService.preloadPopularProjects();
    
//     // Load initial projects
//     loadProjects(activeCategory, searchQuery);
//   }, [loadProjects, activeCategory]);

//   // Debounced search effect
//   useEffect(() => {
//     if (searchTimeout) {
//       clearTimeout(searchTimeout);
//     }

//     const timeout = setTimeout(() => {
//       loadProjects(activeCategory, searchQuery);
//     }, 300); // 300ms debounce

//     setSearchTimeout(timeout);

//     return () => {
//       if (timeout) clearTimeout(timeout);
//     };
//   }, [searchQuery, loadProjects, activeCategory]);

//   const handleProjectClick = (projectId: string) => {
//     navigate(`/discover/${projectId}`);
//   };

//   const handleCategoryChange = (category: string) => {
//     setActiveCategory(category);
//     // Clear search when changing categories for better UX
//     if (searchQuery) {
//       setSearchQuery("");
//     }
//   };

//   const categories = [
//     { 
//       id: "all", 
//       label: "All Projects", 
//       icon: Sparkles, 
//       count: dashboard?.stats.total_projects || 0 
//     },
//     { 
//       id: "featured", 
//       label: "Featured", 
//       icon: Star, 
//       count: dashboard?.stats.featured_projects || 0 
//     },
//   ];

//   // Keyboard shortcut handler
//   useEffect(() => {
//     const handleKeyDown = (event: KeyboardEvent) => {
//       if (event.ctrlKey && event.key === 'k') {
//         event.preventDefault();
//         searchInputRef.current?.focus();
//       }
//     };

//     document.addEventListener('keydown', handleKeyDown);
//     return () => document.removeEventListener('keydown', handleKeyDown);
//   }, []);

//   const getRarityColor = (rarity: string) => {
//     switch (rarity.toLowerCase()) {
//       case 'legendary': return 'text-yellow-400';
//       case 'rare': return 'text-purple-400';
//       case 'common': return 'text-blue-400';
//       default: return 'text-gray-400';
//     }
//   };

//   const getNetworkIcon = (network: string) => {
//     return <div className="w-4 h-4 rounded-full bg-blue-500"></div>;
//   };

//   const formatTimeRemaining = (seconds: number) => {
//     if (seconds <= 0) return "Ended";
    
//     const days = Math.floor(seconds / (24 * 3600));
//     const hours = Math.floor((seconds % (24 * 3600)) / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
    
//     if (days > 0) return `${days}d ${hours}h`;
//     if (hours > 0) return `${hours}h ${minutes}m`;
//     return `${minutes}m`;
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-[#0B0A14] via-[#1a1625] to-[#0B0A14]">
//       <MainNav />
      
//       <main className="container mx-auto px-4 pt-24 pb-12">
//         {/* Header Section */}
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.6 }}
//           className="text-center mb-12"
//         >
//           <div className="inline-flex items-center gap-2 bg-[#5D43EF]/10 border border-[#5D43EF]/20 rounded-full px-4 py-2 mb-6">
//             <Sparkles className="w-4 h-4 text-[#5D43EF]" />
//             <span className="text-sm text-[#5D43EF] font-medium">
//               {dashboard?.stats.active_projects || 0} Active Campaigns
//             </span>
//           </div>
          
//           <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
//             Discover <span className="text-[#5D43EF]">NFT</span> Campaigns
//           </h1>
//           <p className="text-xl text-gray-400 max-w-2xl mx-auto">
//             Complete tasks, earn rewards, and claim exclusive NFTs from top projects
//           </p>
//         </motion.div>

//         {/* Search and Filters */}
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.6, delay: 0.1 }}
//           className="mb-8"
//         >
//           <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
//             {/* Search Bar */}
//             <div className="relative flex-1 max-w-md">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//               <input
//                 ref={searchInputRef}
//                 type="text"
//                 placeholder="Search campaigns... (Ctrl+K)"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 onFocus={() => setIsSearchFocused(true)}
//                 onBlur={() => setIsSearchFocused(false)}
//                 className={cn(
//                   "w-full pl-10 pr-4 py-3 bg-[#1A1625] border rounded-xl text-white placeholder-gray-400 transition-all duration-200",
//                   isSearchFocused
//                     ? "border-[#5D43EF] shadow-lg shadow-[#5D43EF]/20"
//                     : "border-gray-700 hover:border-gray-600"
//                 )}
//               />
//               {searchQuery && (
//                 <button
//                   onClick={() => setSearchQuery("")}
//                   className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
//                 >
//                   ×
//                 </button>
//               )}
//             </div>

//             {/* Category Filters */}
//             <div className="flex gap-2">
//               {categories.map((category) => {
//                 const Icon = category.icon;
//                 return (
//                   <button
//                     key={category.id}
//                     onClick={() => handleCategoryChange(category.id)}
//                     className={cn(
//                       "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium",
//                       activeCategory === category.id
//                         ? "bg-[#5D43EF] text-white shadow-lg shadow-[#5D43EF]/20"
//                         : "bg-[#1A1625] text-gray-400 hover:text-white hover:bg-[#252030] border border-gray-700"
//                     )}
//                   >
//                     <Icon className="w-4 h-4" />
//                     <span>{category.label}</span>
//                     <span className="text-xs opacity-75">({category.count})</span>
//                   </button>
//                 );
//               })}
//             </div>
//           </div>
//         </motion.div>

//         {/* Loading State */}
//         {loading && (
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             className="text-center py-12"
//           >
//             <div className="inline-flex items-center gap-3 text-gray-400">
//               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#5D43EF]"></div>
//               <span>Loading campaigns...</span>
//             </div>
//           </motion.div>
//         )}

//         {/* Error State */}
//         {error && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="text-center py-12"
//           >
//             <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
//               <p className="text-red-400 mb-4">{error}</p>
//               <button
//                 onClick={() => loadProjects(activeCategory, searchQuery)}
//                 className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
//               >
//                 Try Again
//               </button>
//             </div>
//           </motion.div>
//         )}

//         {/* Projects Grid */}
//         {!loading && !error && dashboard && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.6, delay: 0.2 }}
//           >
//             {dashboard.projects.length === 0 ? (
//               <div className="text-center py-12">
//                 <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
//                   <Search className="w-8 h-8 text-gray-400" />
//                 </div>
//                 <h3 className="text-xl font-semibold text-white mb-2">No campaigns found</h3>
//                 <p className="text-gray-400">
//                   {searchQuery ? `No results for "${searchQuery}"` : "No campaigns available in this category"}
//                 </p>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                 {dashboard.projects.map((project, index) => (
//                   <motion.div
//                     key={project.id}
//                     initial={{ opacity: 0, y: 20 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ duration: 0.6, delay: index * 0.1 }}
//                     onClick={() => handleProjectClick(project.id)}
//                     className="group cursor-pointer"
//                   >
//                     <div className="bg-[#1A1625] border border-gray-700 rounded-xl overflow-hidden hover:border-[#5D43EF]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#5D43EF]/10 hover:-translate-y-1">
//                       {/* Project Image */}
//                       <div className="relative h-48 bg-gradient-to-br from-[#5D43EF]/20 to-[#38B2AC]/20 overflow-hidden">
//                         {project.banner_url || project.image_url ? (
//                           <img
//                             src={project.banner_url || project.image_url}
//                             alt={project.title}
//                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
//                             onError={(e) => {
//                               (e.target as HTMLImageElement).style.display = 'none';
//                             }}
//                           />
//                         ) : (
//                           <div className="w-full h-full flex items-center justify-center">
//                             <div className="w-16 h-16 bg-[#5D43EF]/20 rounded-full flex items-center justify-center">
//                               <Trophy className="w-8 h-8 text-[#5D43EF]" />
//                             </div>
//                           </div>
//                         )}
                        
//                         {/* Status Badge */}
//                         <div className="absolute top-3 left-3">
//                           <span className={cn(
//                             "px-2 py-1 rounded-full text-xs font-medium",
//                             project.status === 'active' ? "bg-green-500/20 text-green-400 border border-green-500/30" :
//                             project.status === 'ended' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
//                             "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
//                           )}>
//                             {project.status === 'active' ? 'Live' : 
//                              project.status === 'ended' ? 'Ended' : 'Upcoming'}
//                           </span>
//                         </div>

//                         {/* Featured Badge */}
//                         {project.is_featured && (
//                           <div className="absolute top-3 right-3">
//                             <div className="bg-[#5D43EF] text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
//                               <Star className="w-3 h-3" />
//                               Featured
//                             </div>
//                           </div>
//                         )}
//                       </div>

//                       {/* Project Content */}
//                       <div className="p-6">
//                         {/* Header */}
//                         <div className="flex items-start justify-between mb-4">
//                           <div className="flex-1">
//                             <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#5D43EF] transition-colors">
//                               {project.title}
//                             </h3>
//                             <p className="text-sm text-gray-400 line-clamp-2">
//                               {project.collection_name}
//                             </p>
//                           </div>
//                           <div className="text-sm text-[#38B2AC] font-medium hidden sm:block">
//                             Explore →
//                           </div>
//                         </div>

//                         {/* Project Stats */}
//                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
//                           <div className="flex items-center gap-2">
//                             <div className="w-8 h-8 rounded-full bg-[#38B2AC]/20 flex items-center justify-center flex-shrink-0">
//                               <Coins className="w-4 h-4 text-[#38B2AC]" />
//                             </div>
//                             <div>
//                               <span className="text-xs text-[#94A3B8] block">Reward</span>
//                               <span className="text-sm font-medium text-white">
//                                 {project.reward_amount} {project.reward_currency || "NEFT"}
//                               </span>
//                             </div>
//                           </div>
                          
//                           <div className="flex items-center gap-2">
//                             <div className="w-8 h-8 rounded-full bg-[#805AD5]/20 flex items-center justify-center flex-shrink-0">
//                               <Zap className="w-4 h-4 text-[#805AD5]" />
//                             </div>
//                             <div>
//                               <span className="text-xs text-[#94A3B8] block">Experience</span>
//                               <span className="text-sm font-medium text-white">
//                                 {project.xp_reward} XP
//                               </span>
//                             </div>
//                           </div>
                          
//                           <div className="flex items-center gap-2">
//                             <div className="w-8 h-8 rounded-full bg-[#F6AD55]/20 flex items-center justify-center flex-shrink-0">
//                               <Users className="w-4 h-4 text-[#F6AD55]" />
//                             </div>
//                             <div>
//                               <span className="text-xs text-[#94A3B8] block">Participants</span>
//                               <span className="text-sm font-medium text-white">
//                                 {project.current_participants || 0}/{project.max_participants || "∞"}
//                               </span>
//                             </div>
//                           </div>
                          
//                           <div className="flex items-center gap-2">
//                             <div className="w-8 h-8 rounded-full bg-[#F56565]/20 flex items-center justify-center flex-shrink-0">
//                               <Clock className="w-4 h-4 text-[#F56565]" />
//                             </div>
//                             <div>
//                               <span className="text-xs text-[#94A3B8] block">Time Left</span>
//                               <span className="text-sm font-medium text-white">
//                                 {formatTimeRemaining(project.seconds_remaining || 0)}
//                               </span>
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   </motion.div>
//                 ))}
//               </div>
//             )}
//           </motion.div>
//         )}
//       </main>
//     </div>
//   );
// };

// export default OptimizedDiscover;
