import { Card } from "@/components/ui/card";
import { useState } from "react";
import {
  Clock,
  ImageIcon,
  Trophy,
  Users,
  Sparkles,
  Gem,
  Star,
  Coins,
  Users2,
} from "lucide-react";
import { Link } from "react-router-dom";

interface NFTCardProps {
  id: string;
  name: string;
  image: string;
  price?: string;
  creator: string;
  likes: number;
  isLiked?: boolean;
  endTime?: string;
  projectName: string;
  taskStatus?: "Not Started" | "In Progress" | "Completed";
  owner: string;
  supply: number;
  xpReward: number;
  neftReward: number;
  category: string;
  subcategory: string;
  network?: string;
  isOffchain?: boolean;
  targetChain?: string;
  claimStatus?: "Unclaimed" | "Claiming" | "Claimed";
}

export function NFTCard({
  id,
  name,
  image,
  projectName,
  neftReward,
  xpReward,
  supply,
  endTime = "1d left",
  claimStatus = "Unclaimed",
}: NFTCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
    console.error(`Failed to load image for ${name}`);
  };

  return (
    <Link to={`/project/${id}`}>
      <Card className="group relative bg-[#171923] border-[#2D3748]/50 hover:border-[#38B2AC]/50 hover:shadow-lg hover:shadow-[#38B2AC]/10 transition-all duration-300">
        {/* Image Container */}
        <div className="w-full relative aspect-square">
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1A202C] text-[#94A3B8]">
              <ImageIcon className="w-12 h-12" />
            </div>
          ) : (
            <>
              <img
                src={image}
                alt={name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={handleImageError}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-3 left-3">
                  <div className="text-xs font-medium text-white bg-[#38B2AC] rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    View Details
                  </div>
                </div>
              </div>
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#F56565]" />
                  <span className="text-xs font-medium text-white">
                    {endTime}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white truncate">{name}</h3>
            <p className="text-sm text-[#94A3B8] truncate mt-0.5">
              {projectName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#38B2AC]/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-[#38B2AC]" />
              </div>
              <div>
                <span className="text-xs text-[#94A3B8] block">Reward</span>
                <span className="text-sm font-medium text-white">
                  {neftReward} NEFT
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#805AD5]/20 flex items-center justify-center">
                <Star className="w-4 h-4 text-[#805AD5]" />
              </div>
              <div>
                <span className="text-xs text-[#94A3B8] block">XP</span>
                <span className="text-sm font-medium text-white">
                  {xpReward} XP
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#2D3748]/50">
            <div className="flex items-center gap-1.5">
              <Users2 className="w-4 h-4 text-[#94A3B8]" />
              <span className="text-xs text-[#94A3B8]">{supply} spots</span>
            </div>
            <span className="text-xs text-[#38B2AC] font-medium">
              Explore →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
