import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TierCardProps {
  title: string;
  description: string;
  details?: string;
  colorClass: string;
  className?: string;
}

const TierCard = ({ 
  title, 
  description, 
  details, 
  colorClass, 
  className 
}: TierCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <div className={cn(
        // Base styles
        'relative overflow-hidden rounded-xl p-8',
        'bg-background-card/30 backdrop-blur-xl',
        'border border-border/50',
        'transition-all duration-300 group',
        
        // Hover effects
        'hover:border-primary/20',
        'hover:shadow-lg hover:shadow-primary/5',
        className
      )}>
        {/* Gradient Background */}
        <div className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100',
          'transition-opacity duration-500',
          `from-${colorClass}/5 via-transparent to-transparent`
        )} />

        {/* Content Container */}
        <div className="relative space-y-6">
          {/* Tier Icon */}
          <div className={cn(
            'relative w-20 h-20 rounded-xl mx-auto',
            'flex items-center justify-center',
            'transition-transform duration-300 group-hover:scale-105',
            'overflow-hidden',
            `bg-${colorClass}/10`
          )}>
            {/* Icon Background Gradient */}
            <div className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100',
              'transition-opacity duration-500',
              `from-${colorClass}/20 via-transparent to-transparent`
            )} />
            
            {/* Tier Letter */}
            <span className={cn(
              'relative text-2xl font-space-grotesk font-bold',
              'transition-all duration-300 group-hover:scale-110',
              colorClass
            )}>
              {title[0]}
            </span>
          </div>

          {/* Title */}
          <h3 className={cn(
            'text-xl font-bold text-center font-space-grotesk',
            'bg-clip-text text-transparent',
            'transition-colors duration-300',
            `bg-gradient-to-r from-${colorClass} to-${colorClass}/70`
          )}>
            {title}
          </h3>

          {/* Description */}
          <p className="text-center font-dm-sans text-text-secondary group-hover:text-text-primary transition-colors">
            {description}
          </p>

          {/* Optional Details */}
          {details && (
            <div className={cn(
              'pt-6 mt-6 border-t',
              'transition-colors duration-300',
              'border-border/50 group-hover:border-primary/20'
            )}>
              <p className="text-sm text-center font-manrope text-text-secondary/70 group-hover:text-text-secondary">
                {details}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default TierCard;
