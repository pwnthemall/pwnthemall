import { Challenge } from "@/models/Challenge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, CheckCircle2, Play, AlertCircle } from "lucide-react";
import ChallengeImage from "@/components/challenge/ChallengeImage";

interface ChallengeGridProps {
  challenges: Challenge[];
  loading: boolean;
  onChallengeSelect: (challenge: Challenge) => void;
  instanceStatus?: Record<number, 'running' | 'stopped' | 'building' | 'expired' | 'stopping'>;
  isInstanceChallenge?: (challenge: Challenge) => boolean;
  t: (key: string) => string;
}

const ChallengeGrid = ({
  challenges,
  loading,
  onChallengeSelect,
  instanceStatus = {},
  isInstanceChallenge = () => false,
  t,
}: ChallengeGridProps) => {
  const getPoints = (challenge: Challenge) => {
    if (typeof challenge.currentPoints === "number") return challenge.currentPoints;
    if (typeof challenge.points === "number") return challenge.points;
    return null;
  };

  const getGradientColors = (difficultyColor: string | undefined) => {
    const baseColor = difficultyColor || '#22c55e';
    // Create a lighter version for gradient start
    const lightenColor = (hex: string, percent: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, Math.floor(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * percent));
      const g = Math.min(255, Math.floor(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * percent));
      const b = Math.min(255, Math.floor((num & 0xff) + (255 - (num & 0xff)) * percent));
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    };
    return {
      light: lightenColor(baseColor, 0.4),
      base: baseColor
    };
  };

  const getTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="w-full aspect-video" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        {t("no_challenges_found") !== "no_challenges_found" ? t("no_challenges_found") : "No challenges found"}
      </div>
    );
  }

  // Group challenges by category
  const groupedByCategory = challenges.reduce((acc, challenge) => {
    const categoryName = challenge.challengeCategory?.name || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(challenge);
    return acc;
  }, {} as Record<string, Challenge[]>);

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8">
      {sortedCategories.map((categoryName) => {
        const categoryChallenges = groupedByCategory[categoryName];
        return (
          <div key={categoryName}>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold">{categoryName}</h3>
              <div className="h-px bg-border flex-1" />
              <span className="text-sm text-muted-foreground">
                {categoryChallenges.length} {categoryChallenges.length === 1 ? 'challenge' : 'challenges'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryChallenges.map((challenge) => {
        const points = getPoints(challenge);
        const locked = challenge.locked ?? false;
        const solved = challenge.solved ?? false;
        const solveCount = typeof challenge.solveCount === 'number' ? challenge.solveCount : 0;
        const gradientColors = getGradientColors(challenge.challengeDifficulty?.color);
        const status = instanceStatus[challenge.id];

        return (
          <Card
            key={challenge.id}
            onClick={() => !locked && onChallengeSelect(challenge)}
            className={`cursor-pointer overflow-hidden transition-all hover:shadow-lg group relative ${
              locked ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-1'
            } ${
              solved ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="relative w-full aspect-video overflow-hidden">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    {challenge.emoji && <span className="text-6xl opacity-30">{challenge.emoji}</span>}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                </>
              )}
              
              {/* Status indicators */}
              <div className="absolute top-2 right-2 flex gap-2">
                {locked && (
                  <div className="bg-black/60 backdrop-blur-sm rounded-full p-1.5">
                    <Lock className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                {solved && !locked && (
                  <div className="bg-green-500/90 backdrop-blur-sm rounded-full p-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                {isInstanceChallenge(challenge) && status === 'running' && (
                  <div className="bg-green-600/90 backdrop-blur-sm rounded-full p-1.5">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}
                {isInstanceChallenge(challenge) && status === 'building' && (
                  <div className="bg-orange-600/90 backdrop-blur-sm rounded-full p-1.5 animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              
              {/* Challenge info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge 
                    className="text-xs font-normal border-0"
                    style={{
                      backgroundColor: challenge.challengeDifficulty?.color || '#22c55e',
                      color: getTextColor(challenge.challengeDifficulty?.color || '#22c55e')
                    }}
                  >
                    {challenge.challengeDifficulty?.name || 'Medium'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-white/20 backdrop-blur-sm text-white border-white/30">
                    {challenge.challengeCategory?.name || 'Uncategorized'}
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm line-clamp-1 drop-shadow-lg mb-1">
                  {challenge.name}
                </h3>
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>{points ?? '—'} pts</span>
                  <span>{solveCount} {t("solves") !== "solves" ? t("solves").toLowerCase() : "solves"}</span>
                </div>
              </div>
            </div>
          </Card>
              );
            })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChallengeGrid;
