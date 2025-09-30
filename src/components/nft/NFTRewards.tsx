import { NFTProject } from "@/types/nft";
import { Award, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NFTRewardsProps {
  project: NFTProject;
  className?: string;
}

const rewardStyles = {
  xp: {
    icon: Award,
    text: 'text-[#9D9BF3]',
    gradient: 'from-[#9D9BF3] to-[#6C63FF]',
    glow: 'group-hover:shadow-[0_0_20px_rgba(157,155,243,0.15)]',
    border: 'group-hover:border-[#9D9BF3]/30',
    shimmer: 'from-[#9D9BF3]/20 via-[#6C63FF]/20 to-[#9D9BF3]/20'
  },
  neft: {
    icon: Coins,
    text: 'text-[#36F9F6]',
    gradient: 'from-[#36F9F6] to-[#3E9FFE]',
    glow: 'group-hover:shadow-[0_0_20px_rgba(54,249,246,0.15)]',
    border: 'group-hover:border-[#36F9F6]/30',
    shimmer: 'from-[#36F9F6]/20 via-[#3E9FFE]/20 to-[#36F9F6]/20'
  }
};

export const NFTRewards = ({ project, className }: NFTRewardsProps) => {
  const rewards = [
    { type: 'xp', value: project?.xpReward, label: 'XP', styles: rewardStyles.xp },
    { type: 'neft', value: project?.neftReward, label: 'NEFT', styles: rewardStyles.neft }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("space-y-4", className)}
    >
      <h3 className={cn(
        "text-lg font-semibold font-space-grotesk",
        "text-text-primary",
        "flex items-center gap-2"
      )}>
        <Award className="w-5 h-5 text-[#FFD700]" />
        Complete tasks to earn:
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {rewards.map((reward, index) => (
          <motion.div
            key={reward.type}
            initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={cn(
              // Base styles
              "relative overflow-hidden",
              "bg-background-card/30 backdrop-blur-xl",
              "border border-border/50",
              "px-4 py-3 rounded-xl group",
              "transition-all duration-300",
              
              // Hover effects
              reward.styles.border,
              reward.styles.glow
            )}
          >
            {/* Gradient Background */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
              "transition-opacity duration-500",
              `from-${reward.styles.text}/5 via-transparent to-transparent`
            )} />

            <div className="relative flex items-center gap-3">
              {/* Icon Container */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className={cn(
                  "relative p-2 rounded-lg",
                  "transition-all duration-300",
                  "overflow-hidden",
                  `bg-${reward.styles.text}/10`
                )}
              >
                {/* Icon Background Gradient */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-500",
                  reward.styles.gradient
                )} />
                <reward.styles.icon className={cn(
                  "w-5 h-5 relative transition-transform group-hover:scale-110",
                  reward.styles.text
                )} />
              </motion.div>

              {/* Value and Label */}
              <div className="flex items-baseline gap-1.5">
                <motion.span 
                  className={cn(
                    "text-xl font-bold font-space-grotesk",
                    reward.styles.text,
                    "transition-colors duration-300"
                  )}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  {reward.value}
                </motion.span>
                <span className={cn(
                  "text-sm font-medium font-dm-sans",
                  "text-text-secondary group-hover:text-text-primary/90",
                  "transition-colors duration-300"
                )}>
                  {reward.label}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
