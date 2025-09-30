import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Award,
  Flame,
  Activity,
  Trophy,
  UserCircle,
  Settings,
  LogOut,
  Info,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/components/wallet/WalletProvider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const menuItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Award, label: "Discover", path: "/discover" },
  { icon: Flame, label: "Burn", path: "/burn" },
  { icon: Activity, label: "Activity", path: "/activity" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: UserCircle, label: "Profile", path: "/profile" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: Info, label: "How NEFTIT Works", path: "/how-it-works" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { disconnect } = useWallet();

  const handleLogout = () => {
    try {
      // Disconnect wallet
      disconnect();
      
      // Clear all localStorage items (this is now being handled more thoroughly in WalletProvider)
      
      // Show success toast
      toast.success("Logged out successfully");
      
      // Dispatch event for other components that might need to know about logout
      window.dispatchEvent(new CustomEvent('user-logout'));
      
      // Use direct window.location for a complete page refresh
      // This is more reliable than navigate() for resetting state
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } catch (error) {
      console.error("Error during logout:", error);
      toast.error("Error logging out. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        "w-20 md:w-64 h-screen fixed left-0 overflow-y-auto",
        "sidebar-bg backdrop-blur-xl",
        "border-r border-border",
        "flex flex-col"
      )}
    >
      

      {/* Menu Items */}
      <div className="flex-1 py-8">
        <ul className="space-y-2 px-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <motion.li
                key={item.path}
                whileHover={{ x: 4 }}
                className="relative"
              >
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center px-4 py-3 rounded-xl",
                    "transition-all duration-300 group",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                  )}
                >
                 
                  <span className="hidden md:block font-manrope">
                    {item.label}
                  </span>

                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute right-4 hidden md:flex items-center"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>

      {/* Logout */}
      <div className="px-4 pb-6">
        <motion.button
          onClick={handleLogout}
          whileHover={{ x: 4 }}
          className={cn(
            "flex items-center w-full px-4 py-3 rounded-xl",
            "text-[#5d43ef] hover:bg-[#1b1930]",
            "transition-all duration-300 group"
          )}
        >
          <LogOut
            className={cn(
              "h-5 w-5 md:mr-4",
              "transition-transform duration-300",
              "group-hover:scale-110"
            )}
          />
          <span className="hidden md:block font-manrope">Logout</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
