import React, { useState, useEffect } from "react";
import { MainNav } from "@/components/layout/MainNav";
import { motion } from "framer-motion";
import {
  Search,
  Sparkles,
  Clock,
  Trophy,
  Coins,
  Users,
  ChevronRight,
  ArrowRight,
  Star,
  Timer,
  Flame,
  TrendingUp,
  Zap,
  SlidersHorizontal,
  Sliders,
  Eye,
  Heart,
  Share2,
  Play,
  Award,
  Target,
  Rocket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import styles from "./Discover.module.css";
import optimizedCampaignService from "@/services/OptimizedCampaignService";
import { getWalletAddress } from "@/utils/authUtils";
import { useUserActiveProjectsCount } from "@/hooks/useUserActiveProjectsCount";

interface Project {
  id: string;
  title: string;
  description?: string;
  collection_name: string;
  banner_url?: string;
  reward_amount: number;
  reward_currency?: string;
  xp_reward: number;
  max_participants?: number;
  current_participants?: number;
  category: string;
  blockchain?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  is_featured?: boolean;
  metadata?: any;
}

function useActiveProjectsCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const dashboard = await optimizedCampaignService.getProjectsDashboard('all', '', 1, 0);
        setCount(dashboard.stats.total_projects);
      } catch (error) {
        console.error('Error fetching project count:', error);
        setCount(0);
      }
    }
    fetchCount();
  }, []);

  return count;
}

const Discover = () => {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalProjects, setTotalProjects] = useState<number>(0);
  const navigate = useNavigate();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const dashboard = await optimizedCampaignService.getProjectsDashboard(
          activeCategory,
          searchQuery,
          50, // Load first 50 projects
          0
        );

        setProjects(dashboard.projects);
        setTotalProjects(dashboard.stats.total_projects);
      } catch (error) {
        console.error('Error loading projects:', error);
        setProjects([]);
        setTotalProjects(0);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [activeCategory, searchQuery]);

  const handleProjectClick = (projectId: string) => {
    navigate(`/discover/${projectId}`); // ✅ always valid
  };




  const categories = [
    { id: "all", label: "All Projects", icon: Sparkles, count: totalProjects },
    { id: "featured", label: "Featured", icon: Star, count: projects.filter(p => p.is_featured).length },
    // { id: "ending-soon", label: "Ending Soon", icon: Timer, count: projects.filter(p => p.status === "ending-soon").length },
    // { id: "high-rewards", label: "High Rewards", icon: Flame, count: projects.filter(p => p.reward_amount > 100).length },
  ];

  const activeProjects = useActiveProjectsCount();
  const userActiveProjects = useUserActiveProjectsCount(getWalletAddress());

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape' && isSearchFocused) {
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "Legendary": return "text-yellow-400";
      case "Epic": return "text-purple-400";
      case "Rare": return "text-blue-400";
      case "Common": return "text-gray-400";
      default: return "text-gray-400";
    }
  };

  const getNetworkIcon = (network: string) => {
    return `/chain-logos/${network.toLowerCase()}.svg`;
  };

  return (
    <div className="min-h-screen bg-[#0b0a14] font-sora">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[#0b0a14]">

      </div>

      <MainNav />

      <main className="container relative mx-auto px-3 sm:px-4 md:px-6 pt-0 mt-0 pb-10 md:pb-16 space-y-4 md:space-y-6">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-left mb-4"
          >
            <h1 className="text-2xl sm:text-3xl font-bold font-sora tracking-tight text-white mt-0 pt-0">
              Discover Projects
            </h1>
            <p className="text-sm sm:text-base font-sora text-[#94A3B8] mt-1 mb-8">
              Explore cutting-edge NFT projects, earn rewards, and join the next generation of digital collectibles
            </p>
          </motion.div>



          {/* Enhanced Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            {/* Simple Search Bar with rounded corners */}
            <div className="mb-8 flex flex-col md:flex-row gap-3 sm:gap-4 items-center">
              <div className="flex-1 w-full relative flex items-center">
                <Search className="absolute left-3 sm:left-4 text-[#718096] w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search projects, collections, or blockchain networks..."
                  className="w-full h-12 sm:h-[48px] bg-[#1b1930] rounded-full pl-10 sm:pl-12 pr-4 sm:pr-6 text-white placeholder-[#718096] font-sora text-sm sm:text-base border-2 border-[#1b1930] outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-[#5d43ef] transition-all duration-300"
                />
              </div>
              {/* Active Projects Stat Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="hidden px-4 sm:px-6 rounded-full border bg-[#0a0b14] border-[#5d43ef] backdrop-blur-sm transition-all duration-300 sm:flex items-center h-full min-h-[48px]"
              >

                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm text-[#A0AEC0] font-medium">
                    Active Projects
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {activeProjects !== null ? activeProjects : "..."}
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Enhanced Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-8"
          >
            <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "px-3 sm:px-4 py-2 sm:py-2 rounded-xl font-sora transition-colors duration-200 text-xs sm:text-sm",
                    activeCategory === category.id
                      ? "bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white"
                      : "bg-[#0b0a14] text-[#ffffff] border border-[#ffffff] hover:border-[#4A5568]"
                  )}
                >
                  <span className="flex items-center gap-1 sm:gap-2">
                    <category.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">{category.label}</span>
                    <span className="sm:hidden">{category.label.split(' ')[0]}</span>
                  </span>
                </button>
              ))}
              <div className=" sm:hidden flex items-center gap-1 sm:gap-2 ml-auto">
                  <span className="text-xs sm:text-sm text-[#A0AEC0] font-medium">
                    Active Projects
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {activeProjects !== null ? activeProjects : "..."}
                  </span>
                </div>
            </div>
          </motion.div>

          {/* Results Count */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-4 sm:mb-6"
          >
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              {activeCategory === "all" ? (
                <>
                  Showing <span className="text-white font-semibold">{projects.length}</span> of{" "}
                  <span className="text-white font-semibold">{totalProjects !== null ? totalProjects : "..."}</span> projects
                </>
              ) : (
                <>
                  Showing <span className="text-white font-semibold">{projects.length}</span> {activeCategory} projects
                </>
              )}
            </p>
          </motion.div>

          {/* Enhanced Projects Grid */}
          <div
            className={
              viewMode === "grid"
                ? "flex flex-nowrap overflow-x-auto w-full sm:w-auto sm:overflow-x-visible sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-4 md:gap-6 pb-4 sm:pb-0 scrollbar-thumb-[#5d43ef] scrollbar-track-[#19172d]"
                : "flex flex-col gap-3 md:gap-4"
            }
          >
            {loading ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-[#1A202C]/50 border border-[#2D3748]/50 flex items-center justify-center animate-spin">
                  <svg className="w-6 h-6 text-[#5d43ef]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8 8 0 0116.5 2.5 8 8 0 012.5 16.5a8 8 0 0113.5-6.5" />
                  </svg>
                </div>
                <p className="text-white">Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#1A202C]/50 border border-[#2D3748]/50 flex items-center justify-center">
                  <Search className="w-12 h-12 text-[#94A3B8]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No projects found</h3>
                <p className="text-[#94A3B8] mb-6">Try adjusting your search criteria or filters</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              </motion.div>
            ) : (
              projects.map((project) =>
                viewMode === "grid" ? (
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                    className="group rounded-xl bg-gradient-to-t from-[#19172d]/60 via-[#19172d] to-[#5d43ef]/40 border border-[#19172d] hover:scale-105 hover:border-[#5d43ef] hover:shadow-2xl hover:shadow-[#5d43ef]/10 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col min-w-[230px] sm:min-w-0 sm:min-h-[320px]"
                  >
                    {/* Project Image Container */}
                    <div className="relative flex justify-center items-center p-2">
                      <img className="w-full h-32 sm:h-40  border rounded-xl"
                        src="/images/Contest5.jpeg"
                        alt={project.title}
                        loading="lazy"
                      />
                      {project.is_featured && (
                        <span className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-pink-500 text-white text-xs font-bold shadow flex items-center">
                          <svg className="inline-block mr-1 w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 20 20" fill="white"><polygon points="10,1 12,7 18,7 13,11 15,17 10,13 5,17 7,11 2,7 8,7" /></svg>
                          <span className="text-[10px] sm:text-xs">Featured</span>
                        </span>
                      )}
                      {/*{project.category === "ending-soon" && (
                          <span className="absolute top-2 left-2 sm:top-4 sm:left-8 z-10 px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-orange-400 text-white text-xs font-bold shadow">
                            <span className="text-[10px] sm:text-xs">Ending Soon</span>
                          </span>
                        )}*/}
                    </div>
                    {/* Content Section */}
                    <div className="p-2 sm:p-3 flex-1 flex flex-col">
                      <div className="mb-2 sm:mb-3">
                        <h3 className="text-xs sm:text-base lg:text-lg font-bold font-sora text-white mb-1 truncate text-start">
                          {project.title}
                        </h3>
                        <div className="flex items-center justify-between pt-1 sm:pt-2">
                          <p className="text-xs sm:text-sm font-sora text-[#5d43ef] truncate flex-1 mr-2">
                            {project.collection_name}
                          </p>
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#94A3B8]" />
                            <span className="text-xs text-[#94A3B8]">
                              {project.max_participants !== undefined ? project.current_participants + "/" + project.max_participants : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto space-y-2 sm:space-y-3 border-t-2 border-[#2D3748]/50 pt-2 sm:pt-3">
                        <div className="flex flex-nowrap items-center justify-between gap-1 sm:gap-2">
                          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full bg-[#19172d] flex items-center justify-center">
                              <img src="/discoverCard-svg/NEFTIT-LOGO-SYMBOL.svg" className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                            </div>
                            <span className="font-medium text-white text-xs sm:text-sm">
                              {project.reward_amount} {project.reward_currency || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full bg-[#19172d] flex items-center justify-center">
                              <img src="/discoverCard-svg/thunder.svg" className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                            </div>
                            <span className="font-medium text-white text-xs sm:text-sm">
                              {project.xp_reward} XP
                            </span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full bg-[#19172d] flex items-center justify-center">
                              <img src="/icons/NFT.png" className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4" />
                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // List View
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                    className="flex flex-col sm:flex-row rounded-xl bg-[#171923] border border-[#2D3748]/50 hover:border-[#38B2AC]/50 hover:shadow-lg hover:shadow-[#38B2AC]/10 transition-all duration-200 cursor-pointer overflow-hidden"
                  >
                    {/* Project Image */}
                    <div className="relative sm:w-48 md:w-60 flex-shrink-0">
                      <div className="aspect-square w-full overflow-hidden">
                        <img
                          src={project.banner_url}
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                          loading="lazy"
                        />
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-3 left-3">
                            <div className="text-xs md:text-sm font-semibold text-white bg-[#38B2AC] rounded-full px-3 py-1 inline-flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              View Project
                            </div>
                          </div>
                        </div>
                        {/* Timer Badge */}
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-[#F56565]" />
                            <span className="text-xs font-medium text-white">
                              {project.end_date ? new Date(project.end_date).toLocaleDateString() : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <div className="flex-1">
                        {/* Project Info */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-base sm:text-lg font-bold font-sora text-white">
                              {project.title}
                            </h3>
                            <p className="text-xs sm:text-sm font-sora text-[#94A3B8]">
                              {project.collection_name}
                            </p>
                          </div>
                          <div className="text-sm text-[#38B2AC] font-medium hidden sm:block">
                            Explore →
                          </div>
                        </div>

                        {/* Project Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#38B2AC]/20 flex items-center justify-center flex-shrink-0">
                              <Coins className="w-4 h-4 text-[#38B2AC]" />
                            </div>
                            <div>
                              <span className="text-xs text-[#94A3B8] block">
                                Reward
                              </span>
                              <span className="text-sm font-medium text-white">
                                {project.reward_amount} {project.reward_currency || "N/A"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#805AD5]/20 flex items-center justify-center flex-shrink-0">
                              <Zap className="w-4 h-4 text-[#805AD5]" />
                            </div>
                            <div>
                              <span className="text-xs text-[#94A3B8] block">
                                Experience
                              </span>
                              <span className="text-sm font-medium text-white">
                                {project.xp_reward} XP
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#F6AD55]/20 flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4 text-[#F6AD55]" />
                            </div>
                            <div>
                              <span className="text-xs text-[#94A3B8] block">
                                Spots
                              </span>
                              <span className="text-sm font-medium text-white">
                                {project.max_participants !== undefined ? project.max_participants : "N/A"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#F56565]/20 flex items-center justify-center flex-shrink-0">
                              <Clock className="w-4 h-4 text-[#F56565]" />
                            </div>
                            <div>
                              <span className="text-xs text-[#94A3B8] block">
                                Time Left
                              </span>
                              <span className="text-sm font-medium text-white">
                                {project.end_date ? new Date(project.end_date).toLocaleDateString() : "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Discover;