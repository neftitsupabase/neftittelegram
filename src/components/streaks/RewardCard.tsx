import { Card } from "@/components/ui/card";
import { Lock, Gift, Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Reward {
  days: number;
  description: string;
  isLocked: boolean;
  progress: number;
}

export function RewardCard({ reward }: { reward: Reward }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        // Base styles
        "relative overflow-hidden",
        "bg-background-card/30 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300 group",
        
        // Hover effects
        "hover:border-primary/20",
        "hover:shadow-lg hover:shadow-primary/5",
        
        // Locked state
        reward.isLocked && "opacity-60"
      )}>
        {/* Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
          "transition-opacity duration-500",
          reward.isLocked 
            ? "from-gray-500/5 via-transparent to-transparent"
            : "from-primary/5 via-transparent to-transparent"
        )} />

        <div className="relative p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "relative p-2 rounded-xl",
                "transition-all duration-300 group-hover:scale-105",
                "overflow-hidden",
                reward.isLocked ? "bg-gray-500/10" : "bg-primary/10"
              )}>
                {/* Icon Background Gradient */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-500",
                  reward.isLocked 
                    ? "from-gray-500/20 via-transparent to-transparent"
                    : "from-primary/20 via-transparent to-transparent"
                )} />
                <Gift className={cn(
                  "w-5 h-5 relative transition-transform duration-300 group-hover:scale-110",
                  reward.isLocked ? "text-gray-500" : "text-primary"
                )} />
              </div>
              
              <div className="space-y-1">
                <h3 className="font-space-grotesk font-bold text-lg text-text-primary group-hover:text-primary transition-colors">
                  {reward.days} Day Streak
                </h3>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, Math.ceil(reward.days / 7)) }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-3 h-3",
                        reward.isLocked ? "text-gray-500/50" : "text-yellow-500/80"
                      )}
                      fill="currentColor"
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {reward.isLocked && (
              <div className={cn(
                "p-2 rounded-xl bg-gray-500/10",
                "transition-all duration-300 group-hover:scale-105"
              )}>
                <Lock className="w-5 h-5 text-gray-500" />
              </div>
            )}
          </div>

          {/* Description */}
          <p className="font-dm-sans text-sm text-text-secondary group-hover:text-text-primary transition-colors">
            {reward.description}
          </p>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-manrope text-text-secondary">Progress</span>
              <span className="text-sm font-manrope font-medium text-primary">
                {reward.progress}%
              </span>
            </div>
            
            {/* Progress Bar Container */}
            <div className="relative h-2 bg-background-card rounded-full overflow-hidden border border-border/50">
              {/* Progress Bar Background Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/0 to-white/5 animate-shimmer" />
              
              {/* Progress Bar Fill */}
              <div 
                className={cn(
                  "absolute h-full rounded-full transition-all duration-700 ease-out",
                  "bg-gradient-to-r from-primary to-accent",
                  "relative overflow-hidden"
                )}
                style={{ width: `${reward.progress}%` }}
              >
                {/* Progress Bar Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
