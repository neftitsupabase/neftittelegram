import { MainNav } from "@/components/layout/MainNav";
import { Share2, Edit, BadgeCheck, Flame, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import MyNFTs from "@/components/profile/MyNFTs";
import BadgeCard from "@/components/profile/BadgeCard";
import { useToast } from "@/components/ui/use-toast";
import { getSupabaseClient } from "@/lib/supabaseClientManager";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getWalletAddress } from "@/utils/authUtils";
import { useAuthState } from "@/hooks/useAuthState";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import { useLevel } from "@/hooks/useLevel";
import BadgeVerificationService from "@/services/BadgeVerificationService";
import { useUserConnections } from "@/hooks/useUserConnections";
import { useState, useEffect } from "react";
import BackgroundSelector from "@/components/profile/BackgroundSelector";

const Profile = () => {
  // Authentication state
  const { isAuthenticated, walletAddress: authWalletAddress, isLoading: authLoading } = useAuthState();

  // NFT data is handled by MyNFTs component - no need to load here

  // UI state
  const [activeTab, setActiveTab] = useState("nfts");
  const [claimedBadges, setClaimedBadges] = useState<Set<string>>(new Set());
  const [showBgSelector, setShowBgSelector] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [badgeEligibility, setBadgeEligibility] = useState<Record<string, boolean>>({});
  const [isVerifyingBadges, setIsVerifyingBadges] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const walletAddress = getWalletAddress() || authWalletAddress;
  const { profile, loading: profileLoading } = useUserProfile(walletAddress);
  const { levelInfo, loading: levelLoading } = useLevel(walletAddress);
  const { connections } = useUserConnections(walletAddress || '');

  // NFTs are now loaded by NFTContext - no need for separate loading function

  // Handle background image selection
  const handleBackgroundSelect = async (imageUrl: string) => {
    if (!walletAddress) return;

    try {
      const updatedMetadata = {
        ...(profile?.metadata || {}),
        background_image_url: imageUrl,
      };

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("users")
        .update({ metadata: updatedMetadata })
        .eq("wallet_address", walletAddress);

      if (error) throw error;

      if (profile) {
        profile.metadata = updatedMetadata;
      }
      setCurrentBackground(imageUrl);
    } catch (error) {
      console.error('Error updating background:', error);
      toast({
        title: "Failed to update background",
        description: "Could not save the new background image",
        variant: "destructive",
      });
    }
  };
  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (walletAddress) {
          const updatedMetadata = {
            ...(profile?.metadata || {}),
            background_image_url: reader.result as string,
          };

          const supabase = getSupabaseClient();
          supabase
            .from("users")
            .update({
              metadata: updatedMetadata,
            })
            .eq("wallet_address", walletAddress)
            .then(({ error }) => {
              if (error) {
                toast({
                  title: "Failed to update background",
                  description: "Could not save the new image",
                  variant: "destructive",
                });
              } else {
                window.location.reload();
              }
            });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle share profile
  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/profile`;
    navigator.clipboard.writeText(profileUrl)
      .then(() => {
        toast({
          title: "Link copied!",
          description: "Profile link copied to clipboard",
        });
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not copy profile link",
          variant: "destructive",
        });
      });
  };

  // Load user's badges
  const loadUserBadges = async () => {
    if (!walletAddress) return;

    try {
      console.log('🔄 Loading user badges...');
      const claimedBadgesList = await BadgeVerificationService.getUserClaimedBadges(walletAddress);
      setClaimedBadges(new Set(claimedBadgesList));

      const discordConnection = connections?.linked_social_accounts.find(acc => acc.provider === 'discord');
      const discordUserId = discordConnection?.provider_id || discordConnection?.social_address?.replace('social:discord:', '');

      const userLevel = levelInfo?.currentLevel || 0;
      const unclaimedBadges = BadgeVerificationService.getBadges().filter(badge => !claimedBadgesList.includes(badge.badgeId));

      if (unclaimedBadges.length === 0) {
        console.log('✅ All badges already claimed');
        setCompletedTasks(new Set(claimedBadgesList));
        return;
      }

      setIsVerifyingBadges(true);
      const eligibilityResults = await BadgeVerificationService.verifyAllBadges(walletAddress, discordUserId, userLevel);
      setBadgeEligibility(eligibilityResults);

      const eligibleBadges = Object.keys(eligibilityResults).filter(badgeId => eligibilityResults[badgeId]);
      setCompletedTasks(new Set(eligibleBadges));
    } catch (error) {
      console.error('❌ Error loading badges:', error);
      toast({
        title: "Error",
        description: "Failed to load badge information",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingBadges(false);
    }
  };

  // Claim badge
  const handleClaimBadge = async (badgeId: string) => {
    if (!walletAddress) return;
    try {
      const result = await BadgeVerificationService.claimBadge(walletAddress, badgeId);
      if (result.success) {
        setClaimedBadges(prev => new Set([...prev, badgeId]));
      } else {
        toast({ title: "Claim Failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      console.error('Error claiming badge:', error);
      toast({ title: "Error", description: "Failed to claim badge", variant: "destructive" });
    }
  };

  // Badge helpers
  const isBadgeAvailable = (badgeId: string) => completedTasks.has(badgeId) && !claimedBadges.has(badgeId);
  const isBadgeClaimed = (badgeId: string) => claimedBadges.has(badgeId);
  const isBadgeEligible = (badgeId: string) => completedTasks.has(badgeId);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0a14]">
      <MainNav setExternalWalletModalOpen={() => { }} />
      <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 ">
        <div className="container mx-auto px-2 sm:px-4 pt-0 mt-0 pb-20">

          {/* Profile Header */}
          <div className="mb-8 relative">
            <div className="bg-[#121021] border border-[#5d43ef]/20 rounded-xl h-[200px] sm:h-[250px] md:h-[300px] relative">
              <img
                src={profile?.metadata?.background_image_url || "/images/profile-bg-2.jpg"}
                alt="Profile Background"
                className="w-full h-full object-cover rounded-xl"
              />

              {/* Edit background */}
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                <Button
                  className="bg-transparent hover:bg-[#5d43ef]/80 text-white p-2 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 shadow-lg"
                  onClick={() => setShowBgSelector(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>

                {showBgSelector && (
                  <BackgroundSelector
                    onSelect={handleBackgroundSelect}
                    onClose={() => setShowBgSelector(false)}
                    initialSelectedBg={currentBackground}
                  />
                )}
              </div>

              {/* Edit profile */}
              <div className="absolute -bottom-8 sm:-bottom-10 right-0 sm:right-0">
                <Button
                  className="bg-[#5d43ef]/40 border border-[#5d43ef]/20 hover:bg-[#5d43ef]/80 text-white px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-1 sm:gap-2 shadow-lg text-xs sm:text-base"
                  onClick={() => navigate('/edit-profile')}
                >
                  <span className="text-xs sm:text-sm">Edit</span>
                  <Edit className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                </Button>
              </div>

              {/* Profile image */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full shadow-2xl overflow-hidden bg-[#1b1930] flex items-center justify-center">
                  {profileLoading ? (
                    <div className="w-full h-full bg-gray-600 animate-pulse" />
                  ) : profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-lg sm:text-xl md:text-2xl font-bold">
                      {profile?.display_name?.slice(0, 2).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="mt-12 sm:mt-16 md:mt-20 mb-6 text-center">
            <span className="text-xl sm:text-2xl font-medium text-white">
              {profileLoading ? "Loading..." : profile?.display_name || "NAME HERE"}
            </span>
          </div>

          {/* Level Progress */}
          <LevelProgressBar
            levelInfo={levelInfo}
            loading={levelLoading}
            className="mb-6 sm:mb-8"
            size="md"
            showXPNumbers={true}
          />

          {/* Tabs */}
          <div className="text-center">
            <div className="flex gap-2 sm:gap-3 mb-6 justify-center">
              {[
                { value: "nfts", label: "My NFTs", icon: <Flame className="h-4 w-4" /> },
                { value: "badges", label: "My Badges", icon: <BadgeCheck className="h-4 w-4" /> }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-sora text-xs sm:text-sm flex-1 sm:flex-none",
                    activeTab === tab.value
                      ? "bg-gradient-to-t from-[#5d43ef] via-[#5d43ef]/80 to-[rgb(167,172,236)] text-white"
                      : "bg-[#0b0a14] text-white border border-white hover:border-[#4A5568]"
                  )}
                >
                  <span className="flex items-center gap-1 sm:gap-2 justify-center">
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === "nfts" && (
                <MyNFTs 
                  walletAddress={walletAddress}
                />
              )}

              {activeTab === "badges" && (
                <div className="mt-0">
                  <div className="bg-[#121021] border border-[#5d43ef]/20 rounded-xl p-6">
                    <div className="text-left mb-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-2">My Badges</h2>
                          <p className="text-gray-400">Track your achievements and progress</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={loadUserBadges}
                            disabled={isVerifyingBadges}
                            className="bg-[#5d43ef] hover:bg-[#5d43ef]/80 text-white px-4 py-2 rounded-lg"
                          >
                            {isVerifyingBadges ? 'Verifying...' : 'Refresh Badges'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Badge Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
                      <BadgeCard
                        badgeId="og-discord"
                        title="OG Discord Badge"
                        imageSrc="/BAdges/1 OG Discord Badge .png"
                        description="Early community member who joined during the initial launch phase"
                        isCompleted={isBadgeEligible("og-discord")}
                        isClaimed={isBadgeClaimed("og-discord")}
                        onClaim={handleClaimBadge}
                      />

                      <BadgeCard
                        badgeId="kysie"
                        title="Kysie Badge"
                        imageSrc="/BAdges/2 Kysie Badge.png"
                        description="Active community contributor who helps others and participates regularly"
                        isCompleted={isBadgeEligible("kysie")}
                        isClaimed={isBadgeClaimed("kysie")}
                        onClaim={handleClaimBadge}
                      />

                      <BadgeCard
                        badgeId="zylo"
                        title="Zylo Badge"
                        imageSrc="/BAdges/3 Zylo Badge.png"
                        description="Dedicated platform supporter who promotes and advocates for the ecosystem"
                        isCompleted={isBadgeEligible("zylo")}
                        isClaimed={isBadgeClaimed("zylo")}
                        onClaim={handleClaimBadge}
                      />

                      <BadgeCard
                        badgeId="dozi"
                        title="Dozi Badge"
                        imageSrc="/BAdges/4 Dozy Badge.png"
                        description="Regular active participant who engages with community activities and events"
                        isCompleted={isBadgeEligible("dozi")}
                        isClaimed={isBadgeClaimed("dozi")}
                        onClaim={handleClaimBadge}
                      />

                      <BadgeCard
                        badgeId="level-20"
                        title="20 Level NEFTIT"
                        imageSrc="/BAdges/6 20 Level NEFTIT.png"
                        description="Achievement for reaching level 20 through active participation and engagement"
                        isCompleted={isBadgeEligible("level-20")}
                        isClaimed={isBadgeClaimed("level-20")}
                        onClaim={handleClaimBadge}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;