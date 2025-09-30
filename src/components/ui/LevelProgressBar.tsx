import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Crown, Star } from 'lucide-react';
import LevelService, { LevelInfo } from '@/services/LevelService';

interface LevelProgressBarProps {
  levelInfo: LevelInfo | null;
  loading?: boolean;
  className?: string;
  showXPNumbers?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const LevelProgressBar: React.FC<LevelProgressBarProps> = ({
  levelInfo,
  loading = false,
  className = "",
  showXPNumbers = true,
  size = 'md'
}) => {
  if (loading) {
    return (
      <div className={`text-center ${className}`}>
        <div className={`mx-auto ${size === 'sm' ? 'w-48' : size === 'lg' ? 'w-80' : 'w-64'}`}>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <div className="h-4 bg-gray-600 animate-pulse rounded w-16"></div>
            <div className="h-4 bg-gray-600 animate-pulse rounded w-20"></div>
          </div>
          <div className={`bg-gray-600 animate-pulse rounded ${size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'}`}></div>
        </div>
      </div>
    );
  }

  if (!levelInfo) {
    return (
      <div className={`text-center ${className}`}>
        <div className={`mx-auto ${size === 'sm' ? 'w-48' : size === 'lg' ? 'w-80' : 'w-64'}`}>
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Level 1</span>
            <span>0/83 XP</span>
          </div>
          <Progress 
            value={0} 
            className={`${size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'} [&>[role=progressbar]]:bg-gradient-to-l from-[#4C32E0] via-[#8073E5] to-[#D5D8F7] bg-[#1b1930]`} 
          />
        </div>
      </div>
    );
  }

  const {
    currentLevel,
    currentXP,
    xpForCurrentLevel,
    xpForNextLevel,
    xpProgressInLevel,
    progressPercentage,
    isMaxLevel
  } = levelInfo;

  return (
    <div className={`text-center ${className}`}>
      <div className={`mx-auto ${size === 'sm' ? 'w-48' : size === 'lg' ? 'w-80' : 'w-64'}`}>
        <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
          <div className="flex items-center gap-1">
            {isMaxLevel ? (
              <Crown className="h-4 w-4 text-yellow-400" />
            ) : (
              <Star className="h-4 w-4 text-[#5d43ef]" />
            )}
            <span className={isMaxLevel ? "text-yellow-400 font-semibold" : "text-white"}>
              Level {currentLevel}
              {isMaxLevel && " (MAX)"}
            </span>
          </div>
          {showXPNumbers && (
            <span>
              {isMaxLevel ? (
                `${LevelService.formatXP(currentXP)} XP`
              ) : (
                `${LevelService.formatXP(xpProgressInLevel)}/${LevelService.formatXP(xpForNextLevel - xpForCurrentLevel)} XP`
              )}
            </span>
          )}
        </div>
        
        <Progress 
          value={progressPercentage} 
          className={`${size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'} [&>[role=progressbar]]:bg-gradient-to-l from-[#4C32E0] via-[#8073E5] to-[#D5D8F7] bg-[#1b1930]`} 
        />
        
        {/* Optional: Show total XP below for larger sizes */}
        {size === 'lg' && (
          <div className="mt-2 text-xs text-gray-500">
            Total XP: {LevelService.formatXP(currentXP)}
            {!isMaxLevel && (
              <span className="ml-2">
                Next Level: {LevelService.formatXP(xpForNextLevel - currentXP)} XP needed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LevelProgressBar;
