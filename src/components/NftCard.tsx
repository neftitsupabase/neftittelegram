import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Share2, Clock, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NFTCardProps {
  id: string;
  title: string;
  image: string;
  price: string;
  currency?: string;
  creator: {
    name: string;
    avatar: string;
  };
  likes?: number;
  timeLeft?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  onClick?: () => void;
  className?: string;
}

const NFTCard: React.FC<NFTCardProps> = ({
  title,
  image,
  price,
  currency = 'NEFT',
  creator,
  likes = 0,
  timeLeft,
  rarity = 'common',
  onClick,
  className
}) => {
  const rarityColors = {
    common: 'from-accent-blue/20 to-accent-blue/10',
    rare: 'from-accent-purple/20 to-accent-purple/10',
    epic: 'from-secondary/20 to-secondary/10',
    legendary: 'from-accent-yellow/20 to-accent-yellow/10'
  };

  const rarityBadgeColors = {
    common: 'bg-accent-blue',
    rare: 'bg-accent-purple',
    epic: 'bg-secondary',
    legendary: 'bg-accent-yellow'
  };

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-background-card',
        'border border-border hover:border-border-hover',
        'backdrop-blur-xl transition-all duration-300',
        'hover:shadow-card-hover cursor-pointer',
        className
      )}
    >
      {/* Rarity Badge */}
      <div className="absolute top-4 right-4 z-10">
        <div className={cn(
          'px-3 py-1 rounded-full text-xs font-medium shadow-glow',
          rarityBadgeColors[rarity],
          'font-manrope'
        )}>
          {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
        </div>
      </div>

      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden">
        <div className={cn(
          'absolute inset-0 bg-gradient-to-b opacity-30',
          rarityColors[rarity]
        )} />
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background-card via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Heart className="w-4 h-4 text-white" />
              </button>
              <span className="text-sm text-white font-medium font-dm-sans">{likes}</span>
            </div>
            <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <Share2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-text-primary font-space-grotesk line-clamp-1">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <img
                src={creator.avatar}
                alt={creator.name}
                className="w-5 h-5 rounded-full ring-2 ring-border"
              />
              <span className="text-sm text-text-secondary font-dm-sans">
                {creator.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-sm text-text-secondary font-dm-sans">Current Price</p>
            <p className="text-lg font-medium text-primary font-poppins">
              {price} {currency}
            </p>
          </div>
          {timeLeft && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background-lighter">
              <Clock className="w-4 h-4 text-text-secondary" />
              <span className="text-sm text-text-secondary font-dm-sans">{timeLeft}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default NFTCard;
