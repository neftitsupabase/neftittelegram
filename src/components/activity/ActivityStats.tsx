import { Card } from "@/components/ui/card";
import { Trophy, Gift, Flame, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const stats = [
  {
    title: "Tasks Completed",
    value: "12",
    change: "+2 this week",
    icon: Trophy,
    color: "purple",
    gradient: "from-purple-500/10 via-transparent to-transparent"
  },
  {
    title: "NFTs Claimed",
    value: "8",
    change: "+1 today",
    icon: Gift,
    color: "blue",
    gradient: "from-blue-500/10 via-transparent to-transparent"
  },
  {
    title: "NFTs Burned",
    value: "5",
    change: "+0 this month",
    icon: Flame,
    color: "orange",
    gradient: "from-orange-500/10 via-transparent to-transparent"
  },
  {
    title: "Upgrades",
    value: "3",
    change: "+1 this week",
    icon: ArrowUpRight,
    color: "green",
    gradient: "from-green-500/10 via-transparent to-transparent"
  },
];

export const ActivityStats = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={cn(
              "relative overflow-hidden",
              "bg-background-card/30 backdrop-blur-xl",
              "border-border hover:border-border-hover",
              "transition-all duration-300 group"
            )}>
              {/* Gradient Background */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
                "transition-opacity duration-500",
                stat.gradient
              )} />

              <div className="relative p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium font-manrope text-text-secondary group-hover:text-text-primary transition-colors">
                    {stat.title}
                  </h3>
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-300",
                    `bg-${stat.color}-500/10 group-hover:bg-${stat.color}-500/20`
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      `text-${stat.color}-500 group-hover:scale-110 transition-transform duration-300`
                    )} />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-2xl font-bold font-space-grotesk text-text-primary group-hover:text-primary transition-colors">
                    {stat.value}
                  </p>
                  <p className={cn(
                    "text-xs font-medium font-dm-sans",
                    `text-${stat.color}-500/80`
                  )}>
                    {stat.change}
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
