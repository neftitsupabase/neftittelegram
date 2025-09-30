import * as React from 'react';
import { Info, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface BadgeCardProps {
  badgeId: string;
  title: string;
  imageSrc: string;
  description: string;
  isCompleted: boolean;
  isClaimed: boolean;
  onClaim: (badgeId: string) => void;
}

const BadgeCard: React.FC<BadgeCardProps> = ({
  badgeId,
  title,
  imageSrc,
  description,
  isCompleted,
  isClaimed,
  onClaim
}) => {
  const isLocked = !isCompleted && !isClaimed;

  return (
    <div
      className={`bg-[#0b0a14] border border-[#5d43ef] rounded-2xl p-3 sm:p-4 text-center transition-all duration-300 relative
        h-64 sm:h-72 md:h-80 lg:h-96`}
    >      
      {/* Badge image */}
      <div
        className="mx-auto mb-4 sm:mb-6 mt-1 rounded-full flex items-center justify-center overflow-hidden
        w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-64 lg:h-64"
      >
        <img 
          src={imageSrc} 
          alt={title} 
          className="w-full h-full object-contain"
        />
      </div>

      {/* Badge title and info icon */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <h3 className="text-white font-medium text-sm sm:text-base md:text-lg">{title}</h3>
        <div className="group relative z-50">
          <Info className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-300 transition-colors" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 sm:px-4 sm:py-3 bg-[#1b1930] border border-[#5d43ef]/20 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[9999] w-52 sm:w-64 md:w-72 lg:w-80 h-auto sm:h-16 flex items-center justify-center shadow-lg pointer-events-none">
            <div className="text-center">
              {description.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-t-4 border-l-4 border-r-4 border-transparent border-t-[#1b1930]"></div>
          </div>
        </div>
      </div>

      {/* Badge status and actions */}
      {isClaimed ? (
        <div className="relative z-20">
          <div className="flex items-center justify-center gap-2 text-green-400">
            <Check className="h-5 w-5" />
            <span className="font-medium">Claimed</span>
          </div>
          {/* Badge is already claimed */}
        </div>
      ) : isCompleted ? (
        <Button
          onClick={() => onClaim(badgeId)}
          className="bg-gradient-to-t from-[#5d43ef]/100 via-[#5d43ef]/80 to-[rgb(167,172,236)] hover:from-[#5d43ef]/90 hover:via-[#5d43ef]/70 hover:to-[rgb(167,172,236)]/90 text-white px-3 sm:px-4 py-1 h-7 sm:h-8 rounded-lg mx-auto relative z-20 text-xs sm:text-sm"
        >
          CLAIM
        </Button>
      ) : (
        <div className="text-gray-400 text-xs sm:text-sm relative z-20">
          Complete task to unlock
        </div>
      )}
    </div>
  );
};

export default BadgeCard;
