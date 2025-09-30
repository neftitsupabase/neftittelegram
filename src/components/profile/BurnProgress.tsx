import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BurnProgressProps {
  commonCount: number;
  platinumCount: number;
  silverCount: number;
  goldCount: number;
}

export const BurnProgress = ({
  commonCount,
  platinumCount,
  silverCount,
  goldCount,
}: BurnProgressProps) => {
  const totalNFTs = commonCount + platinumCount + silverCount + goldCount;
  const burnableNFTs = commonCount + silverCount;

  return (
    <Card className={cn(
      "relative overflow-hidden",
      "bg-background-card backdrop-blur-xl",
      "border-border hover:border-border-hover",
      "transition-all duration-300 group"
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF2E63]/5 via-transparent to-transparent opacity-50" />
      
      <CardContent className="relative p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary font-space-grotesk mb-1">
              Burn Progress
            </h3>
            <p className="text-sm text-text-secondary font-manrope">
              {burnableNFTs} NFTs available to burn
            </p>
          </div>

          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            "bg-[#FF2E63]/10 group-hover:scale-110 transition-transform duration-300"
          )}>
            <Flame className="w-6 h-6 text-[#FF2E63]" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-manrope">
              <span className="text-text-secondary">Common NFTs</span>
              <span className="text-text-primary font-medium">{commonCount}</span>
            </div>
            <Progress value={(commonCount / totalNFTs) * 100} className="bg-background h-2" indicatorClassName="bg-[#36F9F6]" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-manrope">
              <span className="text-text-secondary">Silver NFTs</span>
              <span className="text-text-primary font-medium">{silverCount}</span>
            </div>
            <Progress value={(silverCount / totalNFTs) * 100} className="bg-background h-2" indicatorClassName="bg-[#9D9BF3]" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-manrope">
              <span className="text-text-secondary">Gold NFTs</span>
              <span className="text-text-primary font-medium">{goldCount}</span>
            </div>
            <Progress value={(goldCount / totalNFTs) * 100} className="bg-background h-2" indicatorClassName="bg-[#FFD700]" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-manrope">
              <span className="text-text-secondary">Platinum NFTs</span>
              <span className="text-text-primary font-medium">{platinumCount}</span>
            </div>
            <Progress value={(platinumCount / totalNFTs) * 100} className="bg-background h-2" indicatorClassName="bg-[#FF2E63]" />
          </div>
        </div>

        <Link to="/burn">
          <Button 
            className={cn(
              "w-full bg-[#FF2E63] hover:bg-[#FF2E63]/90",
              "text-black font-medium font-manrope",
              "flex items-center justify-center gap-2"
            )}
          >
            Start Burning
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
