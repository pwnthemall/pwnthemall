import { useState, useEffect } from "react";
import { Challenge } from "@/models/Challenge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeCheck, Lock } from "lucide-react";
import ChallengeImage from "@/components/ChallengeImage";
import { AnimatedBorderCard } from "./AnimatedBorderCard";
import axios from "@/lib/axios";

interface MostSolvedSectionProps {
  onChallengeSelect: (challenge: Challenge) => void;
  t: (key: string) => string;
}

const MostSolvedSection = ({
  onChallengeSelect,
  t,
}: MostSolvedSectionProps) => {
  const [featuredChallenges, setFeaturedChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedChallenges = async () => {
      try {
        const res = await axios.get<Challenge[]>("/api/challenges/featured");
        setFeaturedChallenges(res.data || []);
      } catch (error) {
        console.error("Failed to fetch featured challenges:", error);
        setFeaturedChallenges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedChallenges();
  }, []);

  if (!featuredChallenges || (featuredChallenges.length === 0 && !loading)) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="overflow-hidden">
              <div className="relative w-full aspect-[16/9]">
                <Skeleton className="absolute inset-0" />
              </div>
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))
        ) : (
          featuredChallenges?.map((challenge) => {
            return (
            <AnimatedBorderCard
              key={challenge.id}
              onClick={() => !challenge.locked && onChallengeSelect(challenge)}
              solved={challenge.solved}
              locked={challenge.locked}
            >
              <div className="relative w-full aspect-[16/9] overflow-hidden">
              {challenge.coverImg && challenge.id ? (
                <>
                  <div className="absolute inset-0">
                    <ChallengeImage
                      challengeId={challenge.id}
                      alt={challenge.name || 'Challenge cover'}
                      className="transition-transform group-hover:scale-105"
                      positionX={challenge.coverPositionX}
                      positionY={challenge.coverPositionY}
                      zoom={challenge.coverZoom}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <span className="text-8xl opacity-20">{challenge.emoji || '🎯'}</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
                </>
              )}
              
              <div className="absolute top-3 right-3 flex gap-2">
                {challenge.locked && (
                  <div className="bg-black/60 backdrop-blur-sm rounded-full p-2">
                    <Lock className="w-4 h-4 text-white" />
                  </div>
                )}
                {challenge.solved && !challenge.locked && (
                  <div className="bg-green-500/90 backdrop-blur-sm rounded-full p-2">
                    <BadgeCheck className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <div className="mb-2">
                  <Badge variant="secondary" className="text-xs bg-white/20 backdrop-blur-sm text-white border-white/30">
                    {challenge.challengeCategory?.name || 'Uncategorized'}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold line-clamp-2 drop-shadow-lg">
                  {challenge.name}
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {typeof challenge.solveCount === 'number' ? challenge.solveCount : 0} {t("solves") !== "solves" ? t("solves").toLowerCase() : "solves"}
                </p>
              </div>
            </div>
            </AnimatedBorderCard>
            );
          })
        )}
      </div>
    </section>
  );
};

export default MostSolvedSection;
