import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StepCardProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  isLeft: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ number, icon, title, description, isLeft }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative",
        isLeft ? "md:mr-8" : "md:ml-8"
      )}
    >
      <div className={cn(
        "relative rounded-xl border border-border/50 backdrop-blur-xl",
        "bg-background-card/30 p-6",
        "transition-all duration-300 group",
        "hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
      )}>
        {/* Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100",
          "from-primary/5 via-transparent to-transparent",
          "transition-opacity duration-500 rounded-xl"
        )} />

        <div className="relative flex flex-col items-center md:items-start gap-6">
          {/* Icon Container */}
          <div className={cn(
            "w-14 h-14 rounded-xl bg-background-card",
            "flex items-center justify-center",
            "border border-border/50 group-hover:border-primary/20",
            "transition-all duration-300 group-hover:scale-105",
            "relative overflow-hidden"
          )}>
            {/* Icon Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative text-primary group-hover:scale-110 transition-transform duration-300">
              {icon}
            </div>
          </div>

          {/* Content */}
          <div className="text-center md:text-left space-y-2">
            <h3 className="text-xl font-semibold font-space-grotesk text-text-primary group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm font-dm-sans text-text-secondary/80 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
      
      {/* Timeline Connector */}
      <motion.div 
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.3, type: "spring" }}
        className={cn(
          "hidden md:block absolute top-1/2 transform -translate-y-1/2",
          "w-6 h-6 rounded-full z-10",
          "bg-gradient-to-br from-primary to-accent",
          "shadow-lg shadow-primary/20"
        )}
        style={{ 
          left: isLeft ? "auto" : "-12px", 
          right: isLeft ? "-12px" : "auto"
        }}
      />

      {/* Step Number */}
      <div className={cn(
        "absolute -top-3 z-20",
        isLeft ? "right-0 md:left-0" : "left-0",
        "px-2 py-1 rounded-md",
        "bg-background-card/80 backdrop-blur-sm",
        "border border-border/50",
        "font-manrope text-sm font-medium text-primary"
      )}>
        Step {number}
      </div>
    </motion.div>
  );
};

export default StepCard;
