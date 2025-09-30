import { useParams, useNavigate } from "react-router-dom";
import { MainNav } from "@/components/layout/MainNav";
import StarryBackground from "@/components/layout/StarryBackground";
import { NFTProject } from "@/types/nft";
import {
  ArrowLeft,
  Globe,
  Twitter,
  MessageCircle,
  Sparkles,
  Gem,
  Trophy,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { NFTInfo } from "@/components/nft/NFTInfo";
import { NFTTaskList } from "@/components/nft/NFTTaskList";
import { featuredProjects } from "@/data/nftProjects";
import { motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { SkeletonProps } from "react-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NeftitLogoSymbolIcon, ThunderIcon, NFTIcon } from "@/components/icons/CustomIcons";
import optimizedCampaignService from "@/services/OptimizedCampaignService";
import { getWalletAddress, getAuthStatus } from "@/utils/authUtils";

const mapProjectFromSupabase = (row: any): NFTProject => ({
  id: row.id,
  projectName: row.title,
  nftName: row.collection_name,
  image: row.image_url,
  endTime: row.end_date,
  startTime: row.start_date,
  xpReward: row.xp_reward,
  neftReward: row.reward_amount,
  description: row.description,
  owner: row.owner,
  currentParticipants: row.current_participants || 0,
  maxParticipants: row.max_participants || 100,
  totalSupply: row.total_supply,
  levelRequirement: row.level_requirement,
  category: row.category,
  subcategory: row.subcategory,
  taskStatus: row.task_status,
  usdValue: row.usd_value,
  network: row.network,
  isOffchain: row.is_offchain,
  targetChain: row.target_chain,
  claimStatus: row.claim_status,
  website: row.website,
  twitter: row.twitter,
  discord: row.discord,
  rarityDistribution: row.rarity_distribution || undefined,
  tasks: [],
});

const mapTaskFromSupabase = (row: any) => ({
  id: row.id,
  title: row.title,
  completed: false,
  type: row.type || 'visit_website',
  action_url: row.action_url,
  discord_user_id: row.discord_user_id,
  discord_guild_id: row.discord_guild_id,
  required_role_id: row.required_role_id,
  is_active: row.is_active,
  sort_order: row.sort_order,
});

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<NFTProject | null>(null);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [error, setError] = useState<string | null>(null);
  const [campaignEnded, setCampaignEnded] = useState(false);
  const [isProcessingCampaignEnd, setIsProcessingCampaignEnd] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [loadingUserStats, setLoadingUserStats] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  
  // Image slider state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // Array of slider images
  const sliderImages = [
    "/images/nft/Platinum.jpg",
    "/images/nft/Rare1.jpg", 
    "/images/nft/common1.jpg"
  ];
  // Custom skeleton animation styles
  const skeletonBaseProps: Partial<SkeletonProps> = {
    baseColor: "#2A2B2F",
    highlightColor: "#3A3B3F",
    direction: "ltr",
  };

  // Function to add delay to skeleton items based on their position
  const getSkeletonDelay = (index: number): { className: string } => ({
    className: `animate-pulse-delayed-${index}`,
  });

  // Add custom CSS for delayed animations
  useEffect(() => {
    const style = document.createElement("style");
    const animations = Array(20)
      .fill(0)
      .map(
        (_, i) => `
      @keyframes pulse-delayed-${i} {
        0% { opacity: 0.6; }
        ${i * 5}% { opacity: 0.6; }
        ${i * 5 + 50}% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      .animate-pulse-delayed-${i} {
        animation: pulse-delayed-${i} 2s infinite;
      }
    `
      )
      .join("\n");

    style.textContent = animations;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Preload images
  useEffect(() => {
    const loadImages = async () => {
      try {
        console.log('🖼️ Preloading slider images...');
        const imagePromises = sliderImages.map(src => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              console.log(`✅ Loaded: ${src}`);
              resolve(src);
            };
            img.onerror = () => {
              console.error(`❌ Failed to load: ${src}`);
              reject(src);
            };
            img.src = src;
          });
        });

        await Promise.all(imagePromises);
        console.log('🎉 All slider images loaded successfully!');
        setImagesLoaded(true);
      } catch (error) {
        console.error('❌ Error loading some images:', error);
        // Still show the slider even if some images fail
        setImagesLoaded(true);
      }
    };

    loadImages();
  }, []);

  // Auto-cycle slider images every 2 seconds (only after images are loaded)
  useEffect(() => {
    if (!imagesLoaded) return;

    console.log('🔄 Starting image slider auto-cycle...');
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => {
        const nextIndex = prevIndex === sliderImages.length - 1 ? 0 : prevIndex + 1;
        // console.log(`🖼️ Switching to image ${nextIndex + 1}/${sliderImages.length}`);
        return nextIndex;
      });
    }, 2000); // 2 seconds

    return () => {
      console.log('🛑 Stopping image slider auto-cycle...');
      clearInterval(interval);
    };
  }, [imagesLoaded, sliderImages.length]);

  useEffect(() => {
    const address = getWalletAddress();
    setWalletAddress(address || "");
    
    // Load user stats if wallet is connected
    if (address) {
      loadUserStats(address);
    }
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No project ID provided.");
      return;
    }
    setLoading(true);
    setError(null);
    
    const loadProjectDetails = async () => {
      try {
        const address = getWalletAddress();
        const projectDetails = await optimizedCampaignService.getProjectDetails(id, address);
        
        if (!projectDetails || !projectDetails.project) {
          setError("Project not found.");
          setProject(null);
          return;
        }

        const mappedProject = mapProjectFromSupabase(projectDetails.project);
        mappedProject.tasks = projectDetails.tasks.map(mapTaskFromSupabase);
        
        // Update task completion status based on user completions
        if (projectDetails.user_completions) {
          mappedProject.tasks = mappedProject.tasks.map(task => ({
            ...task,
            completed: projectDetails.user_completions[task.id]?.completed || false
          }));
        }
        
        setProject(mappedProject);
        
      } catch (error) {
        console.error('Error loading project details:', error);
        setError("Failed to load project details.");
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    loadProjectDetails();
  }, [id]);




  const loadUserStats = async (address: string) => {
    try {
      setLoadingUserStats(true);
      const stats = await optimizedCampaignService.getUserProjectStats(address);
      setUserStats(stats);
      console.log(`✅ Loaded user stats for ${address}`);
    } catch (err) {
      console.error('❌ Error loading user stats:', err);
      setUserStats(null);
    } finally {
      setLoadingUserStats(false);
    }
  };

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);


  useEffect(() => {
    if (!project?.endTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(project.endTime);
      const diff = end.getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [project?.endTime, campaignEnded, isProcessingCampaignEnd]);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a14] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br via-black to-black"></div>
        <div className="absolute inset-0 bg-[url('/dots.png')] opacity-20"></div>
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full filter blur-[100px]"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full filter blur-[100px]"></div>
        <div className="relative">
          <MainNav />
          <main className="container mx-auto px-4 pt-0 pb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  className="border-white/10 hover:bg-white/5 text-white opacity-50 cursor-not-allowed"
                  disabled
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Discover
                </Button>
                <div className="flex items-center gap-2">
                  <Skeleton width={40} height={40} circle {...skeletonBaseProps} />
                  <Skeleton width={40} height={40} circle {...skeletonBaseProps} />
                  <Skeleton width={40} height={40} circle {...skeletonBaseProps} />
                </div>
              </div>

              {/* Project Info Section - Mobile Responsive */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-auto lg:h-[calc(100vh-80px)]">
                {/* Left Side - NFT Image - Mobile Responsive */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="col-span-1 lg:col-span-4 h-auto lg:h-full mb-6 lg:mb-0"
                >
                  <div className="w-full h-auto lg:h-full lg:sticky lg:top-24 flex flex-col border border-[#5d34ef]/50 rounded-2xl">
                    <div className="relative overflow-hidden rounded-2xl shadow-[0_0_30px_rgba(56,178,172,0.15)] border border-white/10 group w-full aspect-square max-w-[400px] mx-auto lg:h-[87%] flex items-center justify-center">
                      <Skeleton height={300} width={300} {...skeletonBaseProps} />
                    </div>
                    <div className="flex flex-wrap w-full mt-4 gap-2 justify-evenly lg:h-[13%] lg:items-center">
                      {[1, 2, 3].map((_, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Skeleton width={40} height={40} circle {...skeletonBaseProps} />
                          <Skeleton width={60} height={20} {...skeletonBaseProps} />
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Right Side - Project Info - Mobile Responsive */}
                <div className="col-span-1 lg:col-span-8 h-auto lg:h-full overflow-y-auto pr-0 lg:pr-2">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="space-y-8 lg:space-y-[60px] h-auto lg:h-full"
                  >
                    <div className="border-b-[2px] pb-6 flex flex-col md:flex-row md:justify-between gap-4 md:gap-0">
                      <div className="space-y-1">
                        <Skeleton width={120} height={24} {...skeletonBaseProps} />
                        <Skeleton width={200} height={40} {...skeletonBaseProps} />
                      </div>
                      <div className="space-y-1 bg-white/5 rounded-lg p-3 w-full md:w-[180px]">
                        <div className="text-xs text-gray-400 text-center font-semibold tracking-wider">ENDS IN</div>
                        <div className="flex justify-center">
                          <Skeleton width={120} height={32} {...skeletonBaseProps} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen bg-[#0A0A0F]">
        <StarryBackground />
        <MainNav />
        <main className="container relative mx-auto px-4 pt-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-4 text-center">
              <div className="text-4xl text-gray-400">😢</div>
              <div className="text-2xl font-bold text-white">{error}</div>
              <Button
                variant="outline"
                onClick={() => navigate("/discover")}
                className="mt-4 border-white/10 hover:bg-white/5 text-white"
              >
                Back to Discover
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="relative min-h-screen bg-[#0A0A0F]">
        <StarryBackground />
        <MainNav />
        <main className="container relative mx-auto px-4 pt-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-4 text-center">
              <div className="text-4xl text-gray-400">😢</div>
              <div className="text-2xl font-bold text-white">
                Project Not Found
              </div>
              <div className="text-gray-400">
                The project you're looking for doesn't exist or has been
                removed.
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/discover")}
                className="mt-4 border-white/10 hover:bg-white/5 text-white"
              >
                Back to Discover
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0a14] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br via-black to-black"></div>
      <div className="absolute inset-0 bg-[url('/dots.png')] opacity-20"></div>
      <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full filter blur-[100px]"></div>
      <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full filter blur-[100px]"></div>
      <div className="relative">
        <MainNav />
        <main className="container mx-auto px-4 pt-0 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                className="border-[#5d43ef]/60 hover:bg-[#5d43ef]/40 text-white rounded-2xl"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back 
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-[#5d43ef] hover:bg-[#5d43ef]/60 text-white"
                  onClick={() => window.open(project.website, "_blank")}
                >
                  <Globe className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-[#5d43ef] hover:bg-[#5d43ef]/60 text-white"
                  onClick={() => window.open(project.twitter, "_blank")}
                >
                  <Twitter className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-[#5d43ef] hover:bg-[#5d43ef]/60 text-white"
                  onClick={() => window.open(project.discord, "_blank")}
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Project Info Section - Mobile Responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[calc(100vh-80px)]">
              {/* Left Side - NFT Image - Mobile Responsive */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="col-span-1 lg:col-span-4 lg:h-full mb-6 lg:mb-0 w-full"
              >
                <div className="w-full max-w-[400px] mx-auto md:w-[350px] lg:w-full lg:max-h-[500px] lg:sticky lg:top-24 border border-[#5d34ef]/50 rounded-2xl">
                  <div className="relative overflow-hidden rounded-2xl shadow-[0_0_30px_rgba(56,178,172,0.15)] border border-white/10 group h-[300px] sm:h-[400px] md:h-[350px] lg:h-[450px] xl:h-[500px]">
                    {loading || !imagesLoaded ? (
                      /* Enhanced Image Loading Skeleton */
                      <div className="w-full h-full bg-gradient-to-br from-[#1a1625] via-[#242038] to-[#1a1625] rounded-2xl relative overflow-hidden">
                        {/* Animated shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5d43ef]/10 to-transparent animate-pulse"></div>
                        
                        {/* Mock image placeholder */}
                        <div className="w-full h-full bg-[#2a2445] rounded-2xl flex items-center justify-center relative">
                          {/* NFT icon placeholder */}
                          <div className="text-center space-y-4">
                            <div className="w-20 h-20 mx-auto bg-[#5d43ef]/20 rounded-2xl animate-pulse flex items-center justify-center">
                              <svg className="w-10 h-10 text-[#5d43ef]/40" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                            </div>
                            <div className="space-y-2">
                              <div className="h-2 bg-[#5d43ef]/30 rounded w-20 mx-auto animate-pulse"></div>
                              <div className="h-1.5 bg-[#5d43ef]/20 rounded w-16 mx-auto animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Mock slider indicators */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                          {[0, 1, 2].map((index) => (
                            <div
                              key={index}
                              className={`w-2 h-2 rounded-full animate-pulse ${
                                index === 0 ? 'bg-[#5d43ef]/40' : 'bg-white/20'
                              }`}
                            />
                          ))}
                        </div>
                        
                        {/* Loading text */}
                        <div className="absolute top-4 left-4 text-xs text-[#5d43ef]/60">
                          {loading ? 'Loading project...' : 'Loading images...'}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Image Slider */}
                        <div className="relative w-full h-full">
                          {sliderImages.map((image, index) => (
                            <motion.img
                              key={index}
                              src={image}
                              alt={`NFT Collection - Image ${index + 1}`}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                              initial={{ opacity: 0 }}
                              animate={{ 
                                opacity: index === currentImageIndex ? 1 : 0,
                                scale: index === currentImageIndex ? 1 : 1.1
                              }}
                              transition={{ 
                                duration: 0.8,
                                ease: "easeInOut"
                              }}
                              onLoad={() => console.log(`🖼️ Image ${index + 1} rendered successfully`)}
                              onError={(e) => {
                                console.error(`❌ Error rendering image ${index + 1}: ${image}`);
                                const target = e.target as HTMLImageElement;
                                target.src = "https://images.unsplash.com/photo-1485827404703-89b55fcc595e";
                              }}
                            />
                          ))}
                        </div>
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        {/* Slider Indicators */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                          {sliderImages.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                console.log(`🎯 Manual switch to image ${index + 1}`);
                                setCurrentImageIndex(index);
                              }}
                              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                index === currentImageIndex 
                                  ? 'bg-[#5d43ef] scale-125' 
                                  : 'bg-white/40 hover:bg-white/60'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Right Side - Project Info - Mobile Responsive */}
              <div className="col-span-1 lg:col-span-8 lg:h-full overflow-y-auto pr-0 lg:pr-2 w-full">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-8 lg:space-y-[60px] lg:h-full"
                >
                  {/* Header Section - Mobile Responsive */}
                  <div className="border-b-[2px] pb-6 flex flex-col md:flex-row md:justify-between gap-4 md:gap-0">
                    <div className="space-y-1">
                      <h2 className="text-sm md:text-lg font-medium text-[#5d34ef]/80 break-words">
                        {project.projectName}
                      </h2>
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight break-words">
                        {project.nftName}
                      </h1>
                    </div>

                    <div className="flex items-center justify-center md:justify-around">
                      <div className="w-12 h-12 rounded-full mr-2 md:mr-4">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Ethereum-icon-purple.svg/640px-Ethereum-icon-purple.svg.png" alt="" className="w-full h-full"/>
                      </div>
                      <div className="space-y-1 bg-white/5 rounded-lg p-3 w-full md:w-[200px]">
                        <div className="text-xs text-gray-400 text-center font-semibold tracking-wider">ENDS IN</div>
                        <div className="flex justify-center">
                          <div className="inline-block bg-yellow-200 text-black font-bold rounded px-3 py-1 text-center text-sm md:text-base w-full md:w-full">
                            {timeLeft.days}D : {timeLeft.hours}h : {timeLeft.minutes}m : {timeLeft.seconds}s
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* About Section */}
                  <div className="bg-[#0b0a14] backdrop-blur-sm rounded-lg py-3 space-y-4 relative">
                    <div className="flex items-center gap-2 absolute left-0 -top-4">
                      <h3 className="text-lg font-semibold text-white bg-[#0b0a14]">
                        About This Campaign
                      </h3>
                    </div>

                    <p className="text-sm md:text-base text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {project.description}
                    </p>
                  </div>

                  {/* Rarity Distribution - Mobile Responsive */}
                  {project.rarityDistribution && (
                    <div className="bg-[#0b0a14] backdrop-blur-sm rounded-lg py-3 space-y-4 relative">
                      <div className="flex items-center gap-2 absolute left-0 -top-4">
                        <h3 className="text-lg font-semibold text-white bg-[#0b0a14]">
                          Rarity Distribution
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div className="my-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-white mb-2">
                              Legendary
                            </span>
                            <span className="text-sm text-gray-400">
                              {project.rarityDistribution.legendary}%
                            </span>
                           </div> 
                          <Progress
                            value={project.rarityDistribution.legendary}
                            className="h-2 w-full min-w-0 [&>[role=progressbar]]:bg-[#5062d5] bg-white/5"
                          />
                        </div>

                        <div className="my-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-white mb-2">
                              Rare
                            </span>
                            <span className="text-sm text-gray-400">
                              {project.rarityDistribution.rare}%
                            </span>
                          </div>
                          <Progress
                            value={project.rarityDistribution.rare}
                            className="h-2 w-full min-w-0 [&>[role=progressbar]]:bg-[#5062d5] bg-white/5"
                          />
                        </div>

                        <div className="my-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-white mb-2">
                              Common
                            </span>
                            <span className="text-sm text-gray-400">
                              {project.rarityDistribution.common}%
                            </span>
                          </div>
                          <Progress
                            value={project.rarityDistribution.common}
                            className="h-2 w-full min-w-0 [&>[role=progressbar]]:bg-[#5062d5] bg-white/5"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                </motion.div>
              </div>
            </div>


            {/* Tasks and Rewards Section */}
            {isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-12"
              >
                <div className="bg-[#121021] backdrop-blur-sm rounded-xl px-2 py-6 md:py-8 md:px-8">
                  <NFTTaskList tasks={project.tasks} p={project} onTaskComplete={() => walletAddress && loadUserStats(walletAddress)}/>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-12"
              >
                <div className="bg-[#121021] backdrop-blur-sm rounded-xl p-6 text-left">
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Login to Complete Tasks
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Connect your wallet or Login to view and complete tasks for
                    this project.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default ProjectDetails;