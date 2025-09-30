import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Flame, Sparkles, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReferralModal from "@/components/referral/ReferralModal";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useReferral } from "@/hooks/useReferral";
import { Toaster, toast } from "sonner";
import { DailyClaim } from "@/pages/DailyClaim";

export interface NavigationItemType {
  name: string;
  icon?: React.ReactElement;
  path?: string;
  onClick?: (e?: React.MouseEvent) => void;
  badge?: string | number;
  description?: string;
  color?: string;
}

export const navigationItems: NavigationItemType[] = [
  {
    name: "Activity",
    path: "/activity",
    color: "from-blue-500/20 to-blue-600/20",
  },
  {
    name: "Achievements",
    path: "/achievements",
    color: "from-purple-500/20 to-purple-600/20",
  },
  {
    name: "Refer and Earn",
    color: "from-orange-500/20 to-red-500/20",
  },
  {
    name: "Leaderboard",
    path: "/leaderboard",
    color: "from-yellow-500/20 to-amber-600/20",
  },
  {
    name: "How NEFTIT Works",
    path: "/how-it-works",
    color: "from-emerald-500/20 to-teal-600/20",
  },
];

const mobileOnlyNavigationItems: NavigationItemType[] = [
  {
    name: "Burn",
    path: "/burn",
    color: "from-orange-500/20 to-red-500/20",
  },
  {
    name: "Stake",
    path: "/staking",
    color: "from-green-500/20 to-emerald-500/20",
  },
  {
    name: "Daily Claim",
    color: "from-blue-500/20 to-indigo-500/20",
  },
];

export const bottomNavigationItems: NavigationItemType[] = [
  {
    name: "Edit Profile",
    path: "/edit-profile",
    color: "from-blue-500/20 to-blue-600/20",
  },
  {
    name: "Logout",
    color: "from-red-500/20 to-red-600/20",
  },
];

interface NavigationItemsProps {
  items: NavigationItemType[];
}

export function NavigationItems({ items }: NavigationItemsProps) {
  const { disconnect, isConnected } = useWallet();
  const navigate = useNavigate();
  const { referralData, isModalOpen, isLoading, openModal, closeModal, copyReferralLink } =
    useReferral();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isDailyClaimOpen, setIsDailyClaimOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    try {
      disconnect();
      toast.success("Logged out successfully");
      window.dispatchEvent(new CustomEvent("user-logout"));
      setTimeout(() => (window.location.href = "/"), 300);
    } catch (error) {
      console.error("Logout Error:", error);
      toast.error("Error logging out");
    }
  };

  const navItemsWithHandlers = navigationItems.map((item) => {
    if (item.name === "Refer and Earn") {
      return {
        ...item,
        onClick: openModal,
      };
    }
    return item;
  });

  const bottomItemsWithHandlers = bottomNavigationItems.map((item) => {
    if (item.name === "Logout") {
      return {
        ...item,
        onClick: handleLogout,
        icon: <LogOut size={20} />,
      };
    }
    return item;
  });

  const mobileOnlyNavigationItemsWithHandlers = mobileOnlyNavigationItems.map((item) => {
    if (item.name === "Daily Claim") {
      return {
        ...item,
        onClick: () => setIsDailyClaimOpen(true),
      };
    }
    return item;
  });

  const renderNavigationItem = (item: NavigationItemType) => (
    <div key={item.name} className="relative group">
      {item.path ? (
        <Link to={item.path} className="block">
          <Button
            variant="ghost"
            className="w-full justify-between text-left hover:bg-[#1b1930] transition-all duration-200 rounded-lg overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="text-white/70">{item.icon}</div>
              <div className="text-left">
                <div className="font-medium text-sm text-white">{item.name}</div>
              </div>
            </div>
          </Button>
        </Link>
      ) : (
        <Button
          onClick={item.onClick}
          variant="ghost"
          className={`w-full justify-between text-left hover:bg-[#1b1930] transition-all duration-200 rounded-lg overflow-hidden ${item.name === "Logout" ? "mt-1" : ""
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={item.name === "Logout" ? "text-[#5d43ef] ml-3" : "text-white/70"}>
              {item.icon}
            </div>
            <div className="text-left">
              <div className={`font-medium text-sm ${item.name === "Logout" ? "text-[#5d43ef]" : "text-white"}`}>
                {item.name}
              </div>
            </div>
          </div>
        </Button>
      )}
    </div>
  );

  return (
    <div className="w-full flex flex-col min-h-[calc(100vh-5rem)] bg-[#0b0a14] pt-4">
      {/* Main navigation items */}
      <div className="flex-1 space-y-4 px-2">
        {isMobile && isConnected && (
          <div className="space-y-4 mb-4 border-b border-[#5d43ef]/20 pb-3">
            {mobileOnlyNavigationItemsWithHandlers.map(renderNavigationItem)}
          </div>
        )}
        {navItemsWithHandlers.map((item) => (
          <div key={item.name}>{renderNavigationItem(item)}</div>
        ))}
      </div>

      {/* Bottom navigation items */}
      <div className="space-y-1 pt-3 pb-3 px-2 mt-4 bg-[#0b0a14]">
        <div className="border-t border-[#5d43ef] bg-[#121021] rounded-xl p-2 pt-3 mb-2">
          {bottomItemsWithHandlers.map(renderNavigationItem)}
        </div>
      </div>

      {/* Modals */}
      <ReferralModal
        isOpen={isModalOpen}
        referralData={referralData}
        isLoading={isLoading}
        onToggle={closeModal}
        onCopyLink={copyReferralLink}
      />

      {/* Daily Claim Modal controlled from navigation click */}
      <DailyClaim open={isDailyClaimOpen} onOpenChange={setIsDailyClaimOpen} hideTrigger />

      <Toaster />
    </div>
  );
}