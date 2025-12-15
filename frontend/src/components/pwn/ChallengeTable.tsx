import { Challenge } from "@/models/Challenge";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface ChallengeTableProps {
  challenges: Challenge[];
  loading: boolean;
  sortBy: 'category' | 'name' | 'difficulty' | 'points' | 'solves' | 'status';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'category' | 'name' | 'difficulty' | 'points' | 'solves' | 'status') => void;
  onChallengeSelect: (challenge: Challenge) => void;
  instanceStatus?: Record<number, 'running' | 'stopped' | 'building' | 'expired' | 'stopping'>;
  isInstanceChallenge?: (challenge: Challenge) => boolean;
  t: (key: string) => string;
}

const ChallengeTable = ({
  challenges,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onChallengeSelect,
  instanceStatus = {},
  isInstanceChallenge = () => false,
  t,
}: ChallengeTableProps) => {
  const getPoints = (challenge: Challenge) => {
    if (typeof challenge.currentPoints === "number") return challenge.currentPoints;
    if (typeof challenge.points === "number") return challenge.points;
    return null;
  };

  const SortableHeader = ({ 
    column, 
    label 
  }: { 
    column: typeof sortBy; 
    label: string;
  }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        {sortBy === column ? (
          sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="category" label={t("category") !== "category" ? t("category") : "Category"} />
              <SortableHeader column="name" label={t("challenge") !== "challenge" ? t("challenge") : "Challenge"} />
              <SortableHeader column="difficulty" label={t("difficulty") !== "difficulty" ? t("difficulty") : "Difficulty"} />
              <SortableHeader column="points" label={t("points") !== "points" ? t("points") : "Points"} />
              <SortableHeader column="solves" label={t("solves") !== "solves" ? t("solves") : "Solves"} />
              <SortableHeader column="status" label={t("status") !== "status" ? t("status") : "Status"} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : challenges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("no_challenges_found") !== "no_challenges_found" ? t("no_challenges_found") : "No challenges found"}
                </TableCell>
              </TableRow>
            ) : (
              challenges.map((challenge) => {
                const points = getPoints(challenge);
                const locked = challenge.locked ?? false;
                const solved = challenge.solved ?? false;
                const solveCount = typeof challenge.solveCount === 'number' ? challenge.solveCount : 0;

                return (
                  <TableRow
                    key={challenge.id}
                    onClick={() => !locked && onChallengeSelect(challenge)}
                    className={`cursor-pointer transition-colors ${
                      locked ? "opacity-60 cursor-not-allowed" : "hover:bg-accent"
                    } ${
                      solved ? "bg-black/20" : ""
                    }`}
                  >
                    <TableCell className="whitespace-nowrap">
                      {challenge.challengeCategory?.name || ""}
                    </TableCell>
                    <TableCell className="min-w-[16rem]">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{challenge.emoji || "🎯"}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{challenge.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{challenge.author}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {challenge.challengeDifficulty?.name || ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {points ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {solveCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {locked ? (
                        <Badge variant="secondary">{t("locked") !== "locked" ? t("locked") : "Locked"}</Badge>
                      ) : solved ? (
                        <Badge>{t("solved") !== "solved" ? t("solved") : "Solved"}</Badge>
                      ) : isInstanceChallenge(challenge) && instanceStatus[challenge.id] ? (
                        instanceStatus[challenge.id] === 'running' ? (
                          <Badge className="bg-green-600 hover:bg-green-700">{t("instance_actions.running") !== "instance_actions.running" ? t("instance_actions.running") : "Running"}</Badge>
                        ) : instanceStatus[challenge.id] === 'building' ? (
                          <Badge className="bg-orange-600 hover:bg-orange-700">{t("instance_actions.building") !== "instance_actions.building" ? t("instance_actions.building") : "Building..."}</Badge>
                        ) : instanceStatus[challenge.id] === 'stopping' ? (
                          <Badge className="bg-orange-600 hover:bg-orange-700">{t("instance_actions.stopping") !== "instance_actions.stopping" ? t("instance_actions.stopping") : "Stopping..."}</Badge>
                        ) : (
                          <Badge variant="outline">{t("open") !== "open" ? t("open") : "Open"}</Badge>
                        )
                      ) : (
                        <Badge variant="outline">{t("open") !== "open" ? t("open") : "Open"}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ChallengeTable;
