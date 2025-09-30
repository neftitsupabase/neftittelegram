import { cn } from "@/lib/utils";
import { CheckCircle, Gift, Flame, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface ActivityProps {
  title: string;
  timestamp: string;
  type: 'task' | 'claim' | 'burn';
  points: number;
}

const Activity: React.FC<ActivityProps> = ({ title, timestamp, type, points }) => {
  const getIcon = () => {
    switch (type) {
      case 'task':
        return <CheckCircle className="h-5 w-5 text-[#39D98A] transition-all duration-300 group-hover:scale-110" />;
      case 'claim':
        return <Gift className="h-5 w-5 text-[#3E9FFE] transition-all duration-300 group-hover:scale-110" />;
      case 'burn':
        return <Flame className="h-5 w-5 text-[#FF2E63] transition-all duration-300 group-hover:scale-110" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'task':
        return {
          gradient: 'from-[#39D98A]/10 via-transparent to-transparent',
          iconBg: 'bg-[#39D98A]/10 group-hover:bg-[#39D98A]/20',
          glow: 'group-hover:shadow-[0_0_20px_rgba(57,217,138,0.15)]',
          border: 'group-hover:border-[#39D98A]/30',
          points: 'text-[#39D98A]'
        };
      case 'claim':
        return {
          gradient: 'from-[#3E9FFE]/10 via-transparent to-transparent',
          iconBg: 'bg-[#3E9FFE]/10 group-hover:bg-[#3E9FFE]/20',
          glow: 'group-hover:shadow-[0_0_20px_rgba(62,159,254,0.15)]',
          border: 'group-hover:border-[#3E9FFE]/30',
          points: 'text-[#3E9FFE]'
        };
      case 'burn':
        return {
          gradient: 'from-[#FF2E63]/10 via-transparent to-transparent',
          iconBg: 'bg-[#FF2E63]/10 group-hover:bg-[#FF2E63]/20',
          glow: 'group-hover:shadow-[0_0_20px_rgba(255,46,99,0.15)]',
          border: 'group-hover:border-[#FF2E63]/30',
          points: 'text-[#FF2E63]'
        };
    }
  };

  const styles = getStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <div className={cn(
        "relative rounded-xl border border-border/50 backdrop-blur-xl",
        "transition-all duration-300 ease-out",
        styles.border,
        styles.glow
      )}>
        {/* Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
          "transition-opacity duration-500 rounded-xl",
          styles.gradient
        )} />

        <div className="relative flex items-center gap-4 p-4">
          {/* Icon Container */}
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300",
            styles.iconBg
          )}>
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-space-grotesk font-medium text-white/90 truncate group-hover:text-white transition-colors duration-300">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-dm-sans text-white/40 text-sm">{timestamp}</p>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <div className="flex items-center gap-1">
                <Zap className={cn("h-3 w-3", styles.points)} />
                <span className={cn("text-sm font-medium font-manrope", styles.points)}>
                  +{points} points
                </span>
              </div>
            </div>
          </div>

          {/* View Details Button - Hidden by default, shown on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button className={cn(
              "p-2 rounded-lg transition-all duration-300",
              styles.iconBg
            )}>
              <ArrowRight className={cn("h-4 w-4", styles.points)} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Activity; 