import { ArrowRight, TrendingUp, Zap, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DiscoverHeaderProps {
  title: string;
  subtitle: string;
}

export const DiscoverHeader = ({ title, subtitle }: DiscoverHeaderProps) => {
  return (
    <div className="bg-[#171923] rounded-xl border border-[#2D3748]/50 p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A202C] border border-[#2D3748]/50 text-[#38B2AC] text-sm font-sora">
              <TrendingUp className="w-4 h-4" />
              Trending Projects
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A202C] border border-[#2D3748]/50 text-[#805AD5] text-sm font-sora">
              <Zap className="w-4 h-4" />
              High Rewards
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A202C] border border-[#2D3748]/50 text-[#F6AD55] text-sm font-sora">
              <Star className="w-4 h-4" />
              Featured
            </span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold font-sora text-white">
            {title}
          </h1>
          
          <p className="text-lg font-sora text-[#94A3B8] max-w-2xl">
            {subtitle}
          </p>
        </div>

        <div>
          <Link to="/submit-project">
            <Button size="lg" className="bg-[#38B2AC] hover:bg-[#319795] text-white font-bold px-6 h-12 rounded-lg font-sora">
              Submit Project
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
