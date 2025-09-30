import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { AchievementStatus } from '@/lib/achievements';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface ProgressIndicatorProps {
  status: AchievementStatus;
  currentValue: number;
  targetValue: number;
  onClick?: () => void;
  className?: string;
}

export const getStatusColor = (status: AchievementStatus) => {
  switch (status) {
    case 'not-started':
      return {
        bg: 'bg-[#64748B]',
        text: 'text-[#64748B]',
        gradient: 'from-[#64748B]/10 via-transparent to-transparent',
        border: 'border-[#64748B]/20'
      };
    case 'in_progress':
      return {
        bg: 'bg-[#36F9F6]',
        text: 'text-[#36F9F6]',
        gradient: 'from-[#36F9F6]/10 via-transparent to-transparent',
        border: 'border-[#36F9F6]/20'
      };
    case 'completed':
      return {
        bg: 'bg-[#39D98A]',
        text: 'text-[#39D98A]',
        gradient: 'from-[#39D98A]/10 via-transparent to-transparent',
        border: 'border-[#39D98A]/20'
      };
    default:
      return {
        bg: 'bg-[#64748B]',
        text: 'text-[#64748B]',
        gradient: 'from-[#64748B]/10 via-transparent to-transparent',
        border: 'border-[#64748B]/20'
      };
  }
};

export function ProgressIndicator({ 
  status, 
  currentValue, 
  targetValue, 
  onClick,
  className 
}: ProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // Set a timeout to allow the animation to trigger after the initial render
    const timer = setTimeout(() => {
      const calculatedProgress = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
      setProgress(calculatedProgress);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentValue, targetValue]);
  
  const getStatusText = () => {
    if (status === 'completed') return 'Claim Reward';
    if (status === 'in_progress') return 'In Progress';
    return 'Not Started';
  };

  const colors = getStatusColor(status);
  
  return (
    <div className={cn("flex flex-col space-y-3", className)}>
      {/* Progress Text */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium font-manrope text-text-primary">
            Progress
          </span>
          <span className="text-sm font-manrope text-text-secondary">
            {currentValue} / {targetValue}
          </span>
        </div>
        <span className={cn(
          "text-sm font-medium font-manrope",
          colors.text
        )}>
          {Math.floor(progress)}%
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-2 bg-[#1b1930] rounded-full overflow-hidden border border-border/50">
        {/* Progress Bar Background Shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/0 to-white/5 animate-shimmer" />
        
        {/* Progress Bar Fill */}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={cn(
            "absolute h-full rounded-full",
            "transition-colors duration-300",
            colors.bg,
            "relative overflow-hidden"
          )}
        >
          {/* Progress Bar Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
        </motion.div>
      </div>

      {/* Action Button or Status */}
      {onClick ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClick}
          className={cn(
            "relative overflow-hidden",
            "mt-2 px-4 py-2 rounded-xl",
            "font-medium font-manrope text-sm",
            "transition-all duration-300",
            "border",
            status === 'completed' 
              ? cn("bg-background-card backdrop-blur-sm", colors.border, colors.text)
              : "bg-[#1b1930] border-[#5d43ef]/80 text-text-secondary hover:text-text-primary"
          )}
        >
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 hover:opacity-100",
            "transition-opacity duration-500",
            colors.gradient
          )} />
          <div className="relative flex items-center justify-center gap-2">
            <span>{getStatusText()}</span>
            {status === 'completed' && (
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </div>
        </motion.button>
      ) : (
        <div className={cn(
          "relative overflow-hidden",
          "mt-2 px-4 py-2 rounded-xl",
          "font-medium font-manrope text-sm text-center",
          "border",
          status === 'in_progress'
            ? cn("bg-background-card/30", colors.border, colors.text)
            : status === 'completed'
            ? cn("bg-background-card/30", colors.border, colors.text)
            : cn("bg-[#1b1930] border-[#5d43ef]/80 text-text-secondary")
        )}>
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-20",
            colors.gradient
          )} />
          <span className="relative">{getStatusText()}</span>
        </div>
      )}
    </div>
  );
}
