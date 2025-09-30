import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isNegative?: boolean;
  className?: string;
}

const BenefitCard: React.FC<BenefitCardProps> = ({ 
  icon, 
  title, 
  description,
  isNegative = false,
  className
}) => {
  const getStyles = () => {
    if (isNegative) {
      return {
        gradient: 'from-[#FF2E63]/10 via-transparent to-transparent',
        iconBg: 'bg-[#FF2E63]/10 group-hover:bg-[#FF2E63]/20',
        iconText: 'text-[#FF2E63]',
        glow: 'group-hover:shadow-[0_0_20px_rgba(255,46,99,0.15)]',
        border: 'group-hover:border-[#FF2E63]/30'
      };
    }
    return {
      gradient: 'from-[#36F9F6]/10 via-transparent to-transparent',
      iconBg: 'bg-[#36F9F6]/10 group-hover:bg-[#36F9F6]/20',
      iconText: 'text-[#36F9F6]',
      glow: 'group-hover:shadow-[0_0_20px_rgba(54,249,246,0.15)]',
      border: 'group-hover:border-[#36F9F6]/30'
    };
  };

  const styles = getStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className={cn(
        // Base styles
        "relative overflow-hidden rounded-xl",
        "bg-background-card/30 backdrop-blur-xl",
        "border border-border/50",
        "p-6 group",
        "transition-all duration-300",
        
        // Hover effects
        styles.border,
        styles.glow,
        
        className
      )}
    >
      {/* Gradient Background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
        "transition-opacity duration-500",
        styles.gradient
      )} />

      <div className="relative flex flex-col items-center text-center space-y-4">
        {/* Icon Container */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className={cn(
            "relative w-14 h-14 rounded-xl",
            "flex items-center justify-center",
            "transition-all duration-300",
            "overflow-hidden",
            styles.iconBg
          )}
        >
          {/* Icon Background Gradient */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
            "transition-opacity duration-500",
            styles.gradient
          )} />
          <div className={cn(
            "relative transition-transform group-hover:scale-110",
            styles.iconText
          )}>
            {icon}
          </div>
        </motion.div>

        {/* Title */}
        <h3 className={cn(
          "text-lg font-semibold font-space-grotesk",
          "transition-colors duration-300",
          "group-hover:text-text-primary"
        )}>
          {title}
        </h3>

        {/* Description */}
        <p className={cn(
          "text-sm font-dm-sans",
          "text-text-secondary",
          "transition-colors duration-300",
          "group-hover:text-text-primary/90"
        )}>
          {description}
        </p>
      </div>
    </motion.div>
  );
};

export default BenefitCard;
