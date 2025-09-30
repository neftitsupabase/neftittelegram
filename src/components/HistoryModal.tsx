import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History, Trophy, Calendar, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Achievement } from "@/lib/achievements";
import { cn } from "@/lib/utils";

interface HistoryModalProps {
  achievements: Achievement[];
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays <= 7) {
    return `${diffDays} days ago`;
  } else if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

export const HistoryModal = ({ achievements }: HistoryModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const completedAchievements = achievements
    .filter((a) => a.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="bg-black/40 border-white/10 hover:bg-purple-500/20 text-sm font-medium"
      >
        <History className="w-4 h-4 mr-2" />
        History
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#171923] border-[#2D3748] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-sora text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#38B2AC]" />
              Achievement History
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {completedAchievements.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-[#38B2AC]/50 mx-auto mb-4" />
                  <p className="text-[#94A3B8]">
                    No achievements completed yet
                  </p>
                </div>
              ) : (
                completedAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="bg-black/20 rounded-lg border border-[#2D3748]/50 overflow-hidden hover:border-[#38B2AC]/20 transition-colors duration-200"
                  >
                    <div className="flex items-start gap-4 p-4">
                      {/* Achievement Image */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={achievement.image}
                          alt={achievement.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-base font-semibold text-white mb-1">
                              {achievement.title}
                            </h4>
                            <p className="text-sm text-[#94A3B8] line-clamp-2">
                              {achievement.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#38B2AC]/20 border border-[#38B2AC]/30">
                              <Star className="w-3 h-3 text-[#38B2AC]" />
                              <span className="text-xs font-medium text-[#38B2AC]">
                                Tier {achievement.tier}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#2D3748]/50">
                          <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              Completed {formatDate(achievement.completedAt!)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 rounded-full bg-[#38B2AC]/10 text-[#38B2AC] text-xs">
                              +{achievement.neftReward} NEFT
                            </div>
                            <div className="px-2 py-0.5 rounded-full bg-[#805AD5]/10 text-[#805AD5] text-xs">
                              +{achievement.xpReward} XP
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
