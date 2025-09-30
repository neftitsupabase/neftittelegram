import { CheckCircle, Gift, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  type: 'task' | 'claim' | 'burn';
  count: number;
  title: string;
  description: string;
}

const StatCard = ({ type, count, title, description }: StatCardProps) => {
  const getStyles = () => {
    switch (type) {
      case 'task':
        return {
          icon: <CheckCircle className="h-5 w-5 text-[#39D98A] transition-all duration-300 group-hover:scale-110" />,
          gradient: 'from-[#39D98A]/10 via-transparent to-transparent',
          iconBg: 'bg-[#39D98A]/10 group-hover:bg-[#39D98A]/20',
          glow: 'group-hover:shadow-[0_0_20px_rgba(57,217,138,0.15)]',
          border: 'group-hover:border-[#39D98A]/30'
        };
      case 'claim':
        return {
          icon: <Gift className="h-5 w-5 text-[#3E9FFE] transition-all duration-300 group-hover:scale-110" />,
          gradient: 'from-[#3E9FFE]/10 via-transparent to-transparent',
          iconBg: 'bg-[#3E9FFE]/10 group-hover:bg-[#3E9FFE]/20',
          glow: 'group-hover:shadow-[0_0_20px_rgba(62,159,254,0.15)]',
          border: 'group-hover:border-[#3E9FFE]/30'
        };
      case 'burn':
        return {
          icon: <Flame className="h-5 w-5 text-[#FF2E63] transition-all duration-300 group-hover:scale-110" />,
          gradient: 'from-[#FF2E63]/10 via-transparent to-transparent',
          iconBg: 'bg-[#FF2E63]/10 group-hover:bg-[#FF2E63]/20',
          glow: 'group-hover:shadow-[0_0_20px_rgba(255,46,99,0.15)]',
          border: 'group-hover:border-[#FF2E63]/30'
        };
    }
  };

  const styles = getStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
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

        <div className="relative p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-xl transition-all duration-300",
              styles.iconBg
            )}>
              {styles.icon}
            </div>
            <h3 className="font-manrope text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {title}
            </h3>
          </div>

          <div className="space-y-1">
            <span className="block text-4xl font-bold font-space-grotesk text-text-primary group-hover:text-primary transition-colors">
              {count}
            </span>
            <p className="text-xs font-dm-sans text-text-secondary/80">
              {description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard; 