import { Achievement, AchievementType } from "@/lib/achievements";
import { ProgressIndicator } from "./ProgressIndicator";
import { Award, CheckCircle2, Medal, Star, Users, Flame, Calendar, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AchievementCardProps {
  achievement: Achievement;
}

export function AchievementCard({ achievement }: AchievementCardProps) {
  const [isClaimed, setIsClaimed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getTypeIcon = (type: AchievementType) => {
    const iconProps = {
      className: cn(
        "w-8 h-8 transition-transform duration-300 group-hover:scale-110",
        getTypeColor(type)
      )
    };

    switch (type) {
      case 'quest':
        return <Award {...iconProps} />;
      case 'common':
      case 'rare':
      case 'legendary':
      case 'platinum':
      case 'silver':
      case 'gold':
        return <Medal {...iconProps} />;
      case 'referral':
        return <Users {...iconProps} />;
      case 'burn':
        return <Flame {...iconProps} />;
      case 'social':
        return <Star {...iconProps} />;
      case 'checkin':
        return <Calendar {...iconProps} />;
      default:
        return <Award {...iconProps} />;
    }
  };

  const getTypeColor = (type: AchievementType) => {
    switch (type) {
      case 'common': return 'text-achievement-common';
      case 'rare': return 'text-achievement-rare';
      case 'legendary': return 'text-achievement-legendary';
      case 'platinum': return 'text-achievement-platinum';
      case 'silver': return 'text-achievement-silver';
      case 'gold': return 'text-achievement-gold';
      case 'quest': return 'text-[#36F9F6]';
      case 'referral': return 'text-[#9D9BF3]';
      case 'burn': return 'text-[#FF2E63]';
      case 'social': return 'text-[#FFD700]';
      case 'checkin': return 'text-[#39D98A]';
      default: return 'text-[#36F9F6]';
    }
  };

  const getGradientStyle = (type: AchievementType) => {
    switch (type) {
      case 'common': return 'from-achievement-common/10 via-transparent to-transparent';
      case 'rare': return 'from-achievement-rare/10 via-transparent to-transparent';
      case 'legendary': return 'from-achievement-legendary/10 via-transparent to-transparent';
      case 'platinum': return 'from-achievement-platinum/10 via-transparent to-transparent';
      case 'silver': return 'from-achievement-silver/10 via-transparent to-transparent';
      case 'gold': return 'from-achievement-gold/10 via-transparent to-transparent';
      case 'quest': return 'from-[#36F9F6]/10 via-transparent to-transparent';
      case 'referral': return 'from-[#9D9BF3]/10 via-transparent to-transparent';
      case 'burn': return 'from-[#FF2E63]/10 via-transparent to-transparent';
      case 'social': return 'from-[#FFD700]/10 via-transparent to-transparent';
      case 'checkin': return 'from-[#39D98A]/10 via-transparent to-transparent';
      default: return 'from-[#36F9F6]/10 via-transparent to-transparent';
    }
  };

  const handleClaim = () => {
    if (achievement.status === 'completed' && !isClaimed) {
      toast.success(`Claimed ${achievement.reward} NEFT for "${achievement.title}"`, {
        description: "Tokens have been added to your wallet",
        action: {
          label: "View Wallet",
          onClick: () => console.log("View wallet clicked"),
        },
      });
      setIsClaimed(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group"
    >
      <div className={cn(
        // Base styles
        "relative overflow-hidden rounded-xl",
        "bg-[#121021] backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300 group",
        "p-6",

        // Hover effects
        "hover:border-[#5d43ef]/80",
        "hover:shadow-lg hover:shadow-primary/5",

        // Locked state
        achievement.status === 'locked' && "opacity-60"
      )}>
        {/* Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
          "transition-opacity duration-500",
          getGradientStyle(achievement.type)
        )} />

        <div className="relative space-y-6">
          {/* Achievement Icon & Reward */}
          <div className="flex justify-between items-start">
            <div className="relative">
              <div className={cn(
                "relative w-16 h-16 rounded-xl",
                "flex items-center justify-center",
                "transition-all duration-300 group-hover:scale-105",
                "overflow-hidden",
                `bg-${achievement.status === 'locked' ? 'gray-500' : getTypeColor(achievement.type).replace('text-', 'bg-')}/10`
              )}>
                {/* Icon Background Gradient */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-500",
                  getGradientStyle(achievement.type)
                )} />
                <div className="relative">
                  {getTypeIcon(achievement.type)}
                </div>
              </div>

              {achievement.status === 'locked' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "absolute -top-2 -right-2 w-6 h-6 rounded-full",
                    "bg-[#121021]/80 backdrop-blur-sm",
                    "border border-border/50",
                    "flex items-center justify-center"
                  )}
                >
                  <Lock className="w-3 h-3 text-text-secondary" />
                </motion.div>
              )}
            </div>

            {/* Reward Badge */}
            <div className={cn(
              "relative overflow-hidden",
              "px-4 py-2 rounded-full",
              "bg-[#121021]/50 backdrop-blur-sm",
              "border border-border/50 group-hover:border-[#5d43ef]/80",
              "transition-all duration-300"
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-space-grotesk text-[11px] sm:text-base font-bold text-text-primary">
                  +{achievement.reward} NEFT
                </span>
              </div>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-xl font-bold font-space-grotesk text-text-primary group-hover:text-primary transition-colors">
                {achievement.title}
              </h3>
              {achievement.status === 'completed' && isClaimed && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                >
                  <CheckCircle2 className="w-5 h-5 text-[#39D98A]" />
                </motion.div>
              )}
            </div>
            <p className="font-dm-sans text-[11px] sm:text-base text-text-secondary leading-relaxed">
              {achievement.description}
            </p>
          </div>

          {/* Progress Indicator */}
          <ProgressIndicator
            status={isClaimed ? 'completed' : achievement.status}
            currentValue={Math.min(achievement.currentValue, achievement.targetValue)}
            targetValue={achievement.targetValue}
            onClick={achievement.status === 'completed' && !isClaimed ? handleClaim : undefined}
          />
        </div>
      </div>
    </motion.div>
  );
}
