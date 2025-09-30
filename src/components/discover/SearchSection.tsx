import { Search, Filter, Boxes, Clock, Zap, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SearchSectionProps {
  onSearch: (query: string) => void;
}

export const SearchSection = ({ onSearch }: SearchSectionProps) => {
  const categories = [
    { name: "All Projects", icon: Boxes },
    { name: "Ending Soon", icon: Clock },
    { name: "High Rewards", icon: Zap },
    { name: "Featured", icon: Award }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <Input 
            type="text"
            placeholder="Search projects by name, category, or chain..."
            className="w-full pl-12 pr-4 h-12 bg-[#171923] border border-[#2D3748]/50 rounded-lg text-white font-sora placeholder:text-[#718096]"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <Button 
          variant="outline" 
          size="lg"
          className="h-12 px-6 bg-[#171923] border border-[#2D3748]/50 rounded-lg text-white font-sora hover:bg-[#1A202C] hover:border-[#4A5568]"
        >
          <Filter className="w-5 h-5 mr-2" />
          Filters
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {categories.map((category) => (
          <button
            key={category.name}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A202C] border border-[#2D3748]/50 text-[#94A3B8] text-sm font-medium font-sora hover:text-[#38B2AC] hover:border-[#38B2AC] transition-colors duration-200"
          >
            <category.icon className="w-4 h-4" />
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};
