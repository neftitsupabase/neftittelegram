import {
  Trophy,
  Award,
  Users,
  Flame,
  Star,
  Calendar,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { achievementCategories } from "@/lib/achievements";

interface FilterTabsProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

const getCategoryIcon = (value: string) => {
  switch (value) {
    case "quest":
      return Award;
    case "nft":
      return Trophy;
    case "social":
      return Users;
    case "referral":
      return Rocket;
    case "burn":
      return Flame;
    case "checkin":
      return Calendar;
    default:
      return Star;
  }
};

export const FilterTabs = ({
  activeCategory,
  setActiveCategory,
}: FilterTabsProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {achievementCategories.map((category) => {
        const Icon = getCategoryIcon(category.value);
        return (
          <button
            key={category.value}
            onClick={() => setActiveCategory(category.value)}
            className={cn(
              "px-4 py-2 rounded-lg font-sora transition-colors duration-200 text-sm",
              "flex items-center gap-2",
              activeCategory === category.value
                ? "bg-[#38B2AC] text-white"
                : "bg-[#171923] text-[#94A3B8] border border-[#2D3748]/50 hover:border-[#4A5568]"
            )}
          >
            <Icon className="w-4 h-4" />
            {category.label}
          </button>
        );
      })}
    </div>
  );
};
