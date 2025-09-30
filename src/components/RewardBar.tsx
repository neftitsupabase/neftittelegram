import React from "react";
import { Coins } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RewardBarProps {
  action: string;
  points: number;
  percentage: number;
  isSpecial?: boolean;
  className?: string;
}

const RewardBar: React.FC<RewardBarProps> = ({
  action,
  points,
  percentage,
  isSpecial = false,
  className
}) => {
  const getStyles = () => {
    if (isSpecial) {
      return {
        text: 'text-[#FFD700]',
        icon: 'text-[#FFD700]',
        gradient: 'from-[#00f5d4] to-[#fee440]',
        glow: 'group-hover:shadow-[0_0_20px_rgba(255,215,0,0.15)]',
        border: 'group-hover:border-[#FFD700]/30',
        shimmer: 'from-[#00f5d4]/20 via-[#fee440]/20 to-[#00f5d4]/20'
      };
    }
    return {
      text: 'text-[#36F9F6]',
      icon: 'text-[#36F9F6]',
      gradient: 'from-[#36F9F6] to-[#3E9FFE]',
      glow: 'group-hover:shadow-[0_0_20px_rgba(54,249,246,0.15)]',
      border: 'group-hover:border-[#36F9F6]/30',
      shimmer: 'from-[#36F9F6]/20 via-[#3E9FFE]/20 to-[#36F9F6]/20'
    };
  };

  const styles = getStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative p-4 rounded-xl group",
        "bg-background-card/30 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        styles.border,
        styles.glow,
        className
      )}
    >
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
        "transition-opacity duration-500",
        `from-${styles.text}/5 via-transparent to-transparent`
      )} />

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <span className={cn(
            "font-medium font-space-grotesk",
            "text-text-primary group-hover:text-text-primary/90",
            "transition-colors duration-300"
          )}>
            {action}
          </span>
          <motion.div 
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Coins
              size={16}
              className={cn(
                "mr-1.5 transition-transform group-hover:scale-110",
                styles.icon
              )}
            />
            <span className={cn(
              "font-semibold font-space-grotesk",
              styles.text
            )}>
              +{points} NEFT
            </span>
          </motion.div>
        </div>

        {/* Progress Bar Container */}
        <div className="relative h-2 bg-background-card rounded-full overflow-hidden border border-border/50">
          {/* Progress Bar Background Shimmer */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-r animate-shimmer",
            styles.shimmer
          )} />
          
          {/* Progress Bar Fill */}
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={cn(
              "absolute h-full rounded-full",
              "transition-all duration-300",
              "relative overflow-hidden"
            )}
          >
            {/* Gradient Fill */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-r",
              styles.gradient
            )} />
            
            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default RewardBar;
