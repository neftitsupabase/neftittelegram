import React from 'react';
import { ChevronUp, ChevronDown, Minus, Award, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User as UserType } from '@/services/LeaderboardService';

interface LeaderboardTableProps {
  users: UserType[];
  displayType: 'neft' | 'nft';
  currentUser: UserType | null;
  className?: string;
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  users,
  displayType,
  currentUser,
  className,
}) => {
  // Function to render rank change indicator
  const renderRankChange = (current: number, previous: number) => {
    const diff = previous - current;

    if (diff > 0) {
      return (
        <div className="flex items-center text-green-500">
          <ChevronUp className="h-3 w-3 mr-0.5" />
          <span className="text-xs">{diff}</span>
        </div>
      );
    } else if (diff < 0) {
      return (
        <div className="flex items-center text-red-500">
          <ChevronDown className="h-3 w-3 mr-0.5" />
          <span className="text-xs">{Math.abs(diff)}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-gray-500">
          <Minus className="h-3 w-3 mr-0.5" />
          <span className="text-xs">0</span>
        </div>
      );
    }
  };

  // Function to format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#2D3748]/50">
      <div className="overflow-x-auto">
        <table className={cn("w-full", className)}>
          <thead>
            <tr className="border-b border-[#2D3748]/50">
              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-[#A0AEC0] uppercase tracking-wider w-12 sm:w-16">
                Rank
              </th>
              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-[#A0AEC0] uppercase tracking-wider">
                User
              </th>
              <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-[#A0AEC0] uppercase tracking-wider">
                {displayType === 'neft' ? 'NEFT' : 'NFTs'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D3748]/50">
            {users.map((user, index) => {
              const isCurrentUser = currentUser && (user.id.toLowerCase() === currentUser.id.toLowerCase() || user.isCurrentUser);
              const isTopThree = index < 3;

              return (
                <tr
                  key={user.id}
                  className={cn(
                    "hover:bg-[#1A202C]/50 transition-colors",
                    isCurrentUser && "bg-[#38B2AC]/10"
                  )}
                >
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className={cn(
                          "flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full",
                          isTopThree ? (
                            index === 0 ? "bg-yellow-500/20 text-yellow-500" :
                              index === 1 ? "bg-gray-400/20 text-gray-400" :
                                "bg-amber-600/20 text-amber-600"
                          ) : "bg-[#2D3748]/50 text-white"
                        )}
                      >
                        {isTopThree ? (
                          <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : (
                          <span className="text-xs sm:text-sm font-medium">{user.rank}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[150px] md:max-w-none text-white">
                          {user.username}
                          {isCurrentUser && (
                            <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-[#1b1930] text-[#5d43ef] px-1 sm:px-2 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                        {isTopThree && (
                          <div className="flex items-center mt-0.5 sm:mt-1">
                            <Star className="h-2 w-2 sm:h-3 sm:w-3 text-yellow-500 mr-1" />
                            <span className="text-[10px] sm:text-xs text-[#A0AEC0] truncate">
                              {index === 0 ? "1st Place" : index === 1 ? "2nd Place" : "3rd Place"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-right">
                    <div className="text-xs sm:text-sm font-medium text-white">
                      {displayType === 'neft'
                        ? formatNumber(user.neftBalance) + ' NEFT'
                        : formatNumber(user.nftCount) + ' NFTs'}
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Current User Row (if not in top 10) - Only show if user is not already in the list */}
      {currentUser && !users.some(user => user.id.toLowerCase() === currentUser.id.toLowerCase()) && (
        <div className="border-t border-[#2D3748] bg-[#5d43ef]/10 px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#2D3748]/50 text-white mr-2 sm:mr-4">
                <span className="text-xs sm:text-sm font-medium">{currentUser.rank}</span>
              </div>

              <div>
                <div className="text-xs sm:text-sm font-medium text-white truncate max-w-[100px] sm:max-w-[150px] md:max-w-none">
                  {currentUser.username}
                  <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-[#1b1930] text-[#5d43ef] px-1 sm:px-2 py-0.5 rounded">
                    You
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="text-xs sm:text-sm font-medium text-white text-right">
                {displayType === 'neft'
                  ? formatNumber(currentUser.neftBalance) + ' NEFT'
                  : formatNumber(currentUser.nftCount) + ' NFTs'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTable;