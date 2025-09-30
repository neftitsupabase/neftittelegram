import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Trophy, Clock, Flame } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function DailyCheckin() {
  const { toast } = useToast();
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem("streak");
    return saved ? JSON.parse(saved) : { count: 0, lastCheckin: null };
  });
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    localStorage.setItem("streak", JSON.stringify(streak));
  }, [streak]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (streak.lastCheckin) {
        const nextCheckin = new Date(streak.lastCheckin).getTime() + 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const distance = nextCheckin - now;

        if (distance < 0) {
          setTimeLeft("");
        } else {
          const hours = Math.floor(distance / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}h ${minutes}m`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [streak.lastCheckin]);

  const handleCheckin = () => {
    const now = new Date();
    const lastCheckin = streak.lastCheckin ? new Date(streak.lastCheckin) : null;
    
    if (!lastCheckin || (now.getTime() - lastCheckin.getTime()) >= 24 * 60 * 60 * 1000) {
      setStreak(prev => ({
        count: prev.count + 1,
        lastCheckin: now.toISOString()
      }));
      toast({
        title: "Daily Check-in Successful! 🎉",
        description: `You've maintained a streak of ${streak.count + 1} days!`,
      });
    } else {
      toast({
        title: "Already Checked In ⏰",
        description: "Please wait 24 hours before your next check-in.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        // Base styles
        "relative overflow-hidden rounded-xl",
        "bg-background-card/30 backdrop-blur-xl",
        "border border-border/50",
        "p-6 group",
        "transition-all duration-300",
        
        // Hover effects
        "hover:border-primary/20",
        "hover:shadow-lg hover:shadow-primary/5"
      )}
    >
      {/* Gradient Background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
        "transition-opacity duration-500",
        "from-[#FFD700]/5 via-transparent to-transparent"
      )} />

      <div className="relative space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className={cn(
                "relative p-2 rounded-xl",
                "transition-all duration-300",
                "overflow-hidden",
                "bg-[#FFD700]/10"
              )}
            >
              {/* Icon Background Gradient */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
                "transition-opacity duration-500",
                "from-[#FFD700]/20 via-transparent to-transparent"
              )} />
              <Trophy className="h-5 w-5 text-[#FFD700] relative transition-transform group-hover:scale-110" />
            </motion.div>
            
            <div className="space-y-1">
              <h2 className="font-space-grotesk font-bold text-xl text-text-primary group-hover:text-primary transition-colors">
                Daily Streaks
              </h2>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(3, Math.ceil(streak.count / 7)) }).map((_, i) => (
                  <Flame
                    key={i}
                    className="w-3 h-3 text-[#FFD700]/80"
                    fill="currentColor"
                  />
                ))}
              </div>
            </div>
          </div>

          {timeLeft && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                "bg-background-card/50 border border-border/50",
                "font-medium font-manrope text-sm text-text-secondary"
              )}
            >
              <Clock className="h-4 w-4 text-[#FFD700]" />
              {timeLeft}
            </motion.div>
          )}
        </div>

        {/* Streak Progress */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className={cn(
                "relative p-2 rounded-xl",
                "transition-all duration-300",
                "overflow-hidden",
                "bg-primary/10"
              )}
            >
              <Calendar className="h-5 w-5 text-primary relative transition-transform group-hover:scale-110" />
            </motion.div>

            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium font-manrope text-text-secondary">
                  Current Streak
                </span>
                <span className="text-sm font-bold font-space-grotesk text-primary">
                  {streak.count} days
                </span>
              </div>

              {/* Progress Bar Container */}
              <div className="relative h-2 bg-background-card rounded-full overflow-hidden border border-border/50">
                {/* Progress Bar Background Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/0 to-white/5 animate-shimmer" />
                
                {/* Progress Bar Fill */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(streak.count % 7) * (100/7)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={cn(
                    "absolute h-full rounded-full",
                    "transition-all duration-300",
                    "relative overflow-hidden"
                  )}
                >
                  {/* Gradient Fill */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent" />
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Check-in Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckin}
            disabled={!!timeLeft}
            className={cn(
              "relative w-full overflow-hidden",
              "px-4 py-3 rounded-xl",
              "font-medium font-manrope text-sm",
              "transition-all duration-300",
              "border border-primary/20",
              "bg-background-card/30 backdrop-blur-xl",
              timeLeft
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            )}
          >
            {/* Button Gradient Background */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-500"
            )} />

            <span className="relative text-text-primary">
              {timeLeft ? "Come back tomorrow!" : "Check in Today"}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
