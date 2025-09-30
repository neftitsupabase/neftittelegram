import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainNav } from "@/components/layout/MainNav";
import StarryBackground from "@/components/layout/StarryBackground";
import { NFTProject } from "@/types/nft";
import {
  ArrowLeft,
  Users,
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NFTTaskList } from "@/components/nft/NFTTaskList";
import { NFTInfo } from "@/components/nft/NFTInfo";
import { NeftitLogoSymbolIcon, ThunderIcon, NFTIcon } from "@/components/icons/CustomIcons";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Skeleton, { SkeletonProps } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { featuredProjects } from "@/data/nftProjects";
import campaignEndService from "@/services/CampaignEndService";
import optimizedCampaignService from "@/services/OptimizedCampaignService";
import { getWalletAddress, getAuthStatus } from "@/utils/authUtils";

const ProjectDetailsOptimized = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<NFTProject | null>(null);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = getAuthStatus();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [error, setError] = useState<string | null>(null);
  const [campaignEnded, setCampaignEnded] = useState(false);
  const [isProcessingCampaignEnd, setIsProcessingCampaignEnd] = useState(false);

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

  // Preload images for optimized version
  useEffect(() => {
    const loadImages = async () => {
      try {
        console.log('🖼️ Preloading optimized slider images...');
        const imagePromises = sliderImages.map(src => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              console.log(`✅ Optimized Loaded: ${src}`);
              resolve(src);
            };
            img.onerror = () => {
              console.error(`❌ Optimized Failed to load: ${src}`);
              reject(src);
            };
            img.src = src;
          });
        });

        await Promise.all(imagePromises);
        console.log('🎉 All optimized slider images loaded successfully!');
        setImagesLoaded(true);
      } catch (error) {
        console.error('❌ Error loading some optimized images:', error);
        // Still show the slider even if some images fail
        setImagesLoaded(true);
      }
    };

    loadImages();
  }, []);

  // Auto-cycle slider images every 2 seconds (only after images are loaded)
  useEffect(() => {
    if (!imagesLoaded) return;

    console.log('🔄 Starting optimized image slider auto-cycle...');
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => {
        const nextIndex = prevIndex === sliderImages.length - 1 ? 0 : prevIndex + 1;
        console.log(`🖼️ Optimized switching to image ${nextIndex + 1}/${sliderImages.length}`);
        return nextIndex;
      });
    }, 2000); // 2 seconds

    return () => {
      console.log('🛑 Stopping optimized image slider auto-cycle...');
      clearInterval(interval);
    };
  }, [imagesLoaded, sliderImages.length]);

  // Load project details using OptimizedCampaignService
  useEffect(() => {
    const loadProjectDetails = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        console.log('🚀 Loading project details with OptimizedCampaignService...');
        
        // Use OptimizedCampaignService for low egress integration
        const walletAddress = getWalletAddress();
        const projectDetails = await optimizedCampaignService.getProjectDetails(id, walletAddress);

        if (!projectDetails || !projectDetails.project) {
          // Fallback to static data
          const staticProject = featuredProjects.find(p => p.id === id);
          if (staticProject) {
            setProject(staticProject);
            console.log('📦 Using fallback static project data');
          } else {
            setError('Project not found');
          }
          return;
        }

        console.log('✅ Successfully loaded project details:', projectDetails.project.title);

        // Map optimized project data to NFTProject format
        const mappedProject: NFTProject = {
          id: projectDetails.project.id,
          projectName: projectDetails.project.title,
          nftName: projectDetails.project.collection_name,
          image: projectDetails.project.image_url || '',
          endTime: projectDetails.project.end_date || '',
          startTime: projectDetails.project.start_date || '',
          xpReward: projectDetails.project.xp_reward,
          neftReward: projectDetails.project.reward_amount,
          description: projectDetails.project.description || '',
          owner: projectDetails.project.owner || '',
          totalSupply: projectDetails.project.total_supply || 1000,
          levelRequirement: projectDetails.project.level_requirement || 1,
          maxParticipants: projectDetails.project.max_participants || 1000,
          category: projectDetails.project.category,
          subcategory: projectDetails.project.subcategory || '',
          taskStatus: (projectDetails.project.task_status as 'Not Started' | 'In Progress' | 'Completed') || 'Not Started',
          usdValue: projectDetails.project.usd_value,
          network: projectDetails.project.network || 'Ethereum',
          isOffchain: projectDetails.project.is_offchain || false,
          targetChain: projectDetails.project.target_chain,
          claimStatus: (projectDetails.project.claim_status as 'Unclaimed' | 'Claiming' | 'Claimed') || 'Unclaimed',
          website: projectDetails.project.website,
          twitter: projectDetails.project.twitter,
          discord: projectDetails.project.discord,
          rarityDistribution: projectDetails.project.rarity_distribution ? {
            common: projectDetails.project.rarity_distribution.common || 0,
            rare: projectDetails.project.rarity_distribution.rare || 0,
            epic: projectDetails.project.rarity_distribution.epic || 0,
            legendary: projectDetails.project.rarity_distribution.legendary || 0,
          } : undefined,
          tasks: projectDetails.tasks.map(task => ({
            id: task.id,
            title: task.title,
            completed: projectDetails.user_completions[task.id]?.completed || false,
            type: task.type,
            buttonState: projectDetails.user_completions[task.id]?.completed ? 2 : 0,
            action_url: task.action_url,
            discord_user_id: task.discord_user_id,
            discord_guild_id: task.discord_guild_id,
            required_role_id: task.required_role_id,
            telegram_channel_id: task.telegram_channel_id,
            website_url: task.website_url,
            quiz_questions: task.quiz_questions,
            quiz_passing_score: task.quiz_passing_score,
            twitter_username: task.twitter_username,
            twitter_tweet_id: task.twitter_tweet_id,
          }))
        };

        setProject(mappedProject);
        console.log(`📋 Mapped ${mappedProject.tasks.length} tasks for project`);
        
      } catch (error) {
        console.error('❌ Error loading project details:', error);
        // Fallback to static data
        const staticProject = featuredProjects.find(p => p.id === id);
        if (staticProject) {
          setProject(staticProject);
          console.log('📦 Using fallback static project data due to error');
        } else {
          setError('Failed to load project details');
        }
      } finally {
        setLoading(false);
      }
    };

    loadProjectDetails();
  }, [id]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Calculate time remaining
  useEffect(() => {
    if (!project?.endTime) return;

    const calculateTimeLeft = () => {
      const endTime = new Date(project.endTime).getTime();
      const now = new Date().getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setCampaignEnded(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setCampaignEnded(true);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [project?.endTime]);

  const handleCampaignEnd = async () => {
    if (!project?.id || isProcessingCampaignEnd) return;

    try {
      setIsProcessingCampaignEnd(true);
      toast.loading("Processing campaign end...");
      
      await campaignEndService.processCampaignEnd(project);
      
      toast.dismiss();
      toast.success("Campaign ended successfully! NFTs have been distributed.");
    } catch (error) {
      console.error('Error processing campaign end:', error);
      toast.dismiss();
      toast.error("Failed to process campaign end");
    } finally {
      setIsProcessingCampaignEnd(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] via-[#1A1A2E] to-[#16213E] text-white relative overflow-hidden">
        <StarryBackground />
        <MainNav />
        <div className="relative z-10 pt-20 pb-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Loading skeleton */}
            <div className="mb-8">
              <Skeleton height={40} width={200} {...skeletonBaseProps} {...getSkeletonDelay(0)} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton height={400} {...skeletonBaseProps} {...getSkeletonDelay(1)} />
                <Skeleton height={200} {...skeletonBaseProps} {...getSkeletonDelay(2)} />
              </div>
              
              <div className="space-y-6">
                <Skeleton height={300} {...skeletonBaseProps} {...getSkeletonDelay(3)} />
                <Skeleton height={200} {...skeletonBaseProps} {...getSkeletonDelay(4)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] via-[#1A1A2E] to-[#16213E] text-white relative overflow-hidden">
        <StarryBackground />
        <MainNav />
        <div className="relative z-10 pt-20 pb-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
              <p className="text-gray-400 mb-8">{error}</p>
              <Button onClick={() => navigate('/discover')} className="bg-purple-600 hover:bg-purple-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Discover
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] via-[#1A1A2E] to-[#16213E] text-white relative overflow-hidden">
        <StarryBackground />
        <MainNav />
        <div className="relative z-10 pt-20 pb-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-gray-400 mb-4">Project Not Found</h1>
              <p className="text-gray-500 mb-8">The project you're looking for doesn't exist.</p>
              <Button onClick={() => navigate('/discover')} className="bg-purple-600 hover:bg-purple-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Discover
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0B0F] via-[#1A1A2E] to-[#16213E] text-white relative overflow-hidden">
      <StarryBackground />
      <MainNav />
      
      <div className="relative z-10 pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Button
              variant="ghost"
              onClick={() => navigate('/discover')}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 p-2"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Discover
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Project header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-[#121021] backdrop-blur-sm rounded-xl p-6 md:p-8"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-xl overflow-hidden">
                      {loading || !imagesLoaded ? (
                        /* Enhanced Compact Loading Skeleton */
                        <div className="w-full h-full bg-gradient-to-br from-[#1a1625] via-[#242038] to-[#1a1625] rounded-xl relative overflow-hidden">
                          {/* Shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5d43ef]/15 to-transparent animate-pulse"></div>
                          
                          {/* Compact NFT placeholder */}
                          <div className="w-full h-full bg-[#2a2445] rounded-xl flex items-center justify-center relative">
                            <div className="w-8 h-8 bg-[#5d43ef]/30 rounded-lg animate-pulse flex items-center justify-center">
                              <svg className="w-4 h-4 text-[#5d43ef]/50" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                            </div>
                          </div>
                          
                          {/* Compact slider indicators */}
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                            {[0, 1, 2].map((index) => (
                              <div
                                key={index}
                                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                  index === 0 ? 'bg-[#5d43ef]/40' : 'bg-white/25'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Image Slider */}
                          {sliderImages.map((image, index) => (
                            <motion.img
                              key={index}
                              src={image}
                              alt={`NFT Collection - Image ${index + 1}`}
                              className="absolute inset-0 w-full h-full object-cover"
                              initial={{ opacity: 0 }}
                              animate={{ 
                                opacity: index === currentImageIndex ? 1 : 0,
                                scale: index === currentImageIndex ? 1 : 1.1
                              }}
                              transition={{ 
                                duration: 0.8,
                                ease: "easeInOut"
                              }}
                              onLoad={() => console.log(`🖼️ Optimized Image ${index + 1} rendered successfully`)}
                              onError={(e) => {
                                console.error(`❌ Error rendering optimized image ${index + 1}: ${image}`);
                                const target = e.target as HTMLImageElement;
                                target.src = "https://images.unsplash.com/photo-1485827404703-89b55fcc595e";
                              }}
                            />
                          ))}
                          
                          {/* Slider Indicators */}
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                            {sliderImages.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  console.log(`🎯 Optimized manual switch to image ${index + 1}`);
                                  setCurrentImageIndex(index);
                                }}
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
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
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-2">{project.projectName}</h1>
                      <h2 className="text-xl text-purple-400 mb-4">{project.nftName}</h2>
                      <p className="text-gray-300 leading-relaxed">{project.description}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-purple-900/50 text-purple-300">
                        {project.category}
                      </Badge>
                      {project.subcategory && (
                        <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                          {project.subcategory}
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                        {project.network}
                      </Badge>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Tasks section */}
              {isAuthenticated ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-12"
                >
                  <div className="bg-[#121021] backdrop-blur-sm rounded-xl p-6 md:p-8">
                    <NFTTaskList tasks={project.tasks} p={project}/>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="mt-12"
                >
                  <div className="bg-[#121021] backdrop-blur-sm rounded-xl p-6 text-center">
                    <h3 className="text-xl font-semibold mb-4">
                      Login to Complete Tasks
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Connect your wallet or Login to view and complete tasks for
                      this project.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <NFTInfo 
                projectName={project.projectName}
                nftName={project.nftName}
                xpReward={project.xpReward}
                neftReward={project.neftReward}
                startTime={project.startTime}
                endTime={project.endTime}
                description={project.description}
                rarityDistribution={project.rarityDistribution}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailsOptimized;
