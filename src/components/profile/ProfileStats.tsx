import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { 
  Trophy, 
  Flame, 
  Coins,
  ScrollText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileStatsProps {
  totalNFTs: number;
  upgradableNFTs: number;
  burnedNFTs: number;
  questsCompleted: number;
}

export const ProfileStats = ({ 
  totalNFTs,
  upgradableNFTs,
  burnedNFTs,
  questsCompleted
}: ProfileStatsProps) => {
  const stats = [
    {
      label: "Total NFTs",
      value: totalNFTs,
      icon: Coins,
      color: "text-[#36F9F6]",
      bgColor: "bg-[#36F9F6]"
    },
    {
      label: "Upgradable NFTs",
      value: upgradableNFTs,
      icon: Trophy,
      color: "text-[#9D9BF3]",
      bgColor: "bg-[#9D9BF3]"
    },
    {
      label: "Burned NFTs",
      value: burnedNFTs,
      icon: Flame,
      color: "text-[#FF2E63]",
      bgColor: "bg-[#FF2E63]"
    },
    {
      label: "Quests Completed",
      value: questsCompleted,
      icon: ScrollText,
      color: "text-[#FFD700]",
      bgColor: "bg-[#FFD700]"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -2 }}
            className="relative"
          >
            <Card className={cn(
              "relative overflow-hidden",
              "bg-background-card backdrop-blur-xl",
              "border-border hover:border-border-hover",
              "p-4 transition-all duration-300 group"
            )}>
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-all duration-500",
                `from-${stat.bgColor}/5 via-transparent to-transparent`
              )} />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    `${stat.bgColor}/10 group-hover:scale-110 transition-transform duration-300`
                  )}>
                    <Icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-text-secondary font-manrope">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-text-primary font-space-grotesk group-hover:text-primary transition-colors">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
