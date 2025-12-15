/**
 * Public User Profile
 * - Responsive single-viewport design
 * - No scrolling required
 */
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Trophy,
  Target,
  Clock,
  Users,
  TrendingUp,
  Percent,
  Activity,
} from "lucide-react";

interface SubmissionStats {
  totalSubmissions: number;
  correctSubmissions: number;
  wrongSubmissions: number;
  successRate: number;
}

interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  solvedCount: number;
  totalCount: number;
  color: string;
}

interface RecentSolve {
  challengeId: number;
  challengeName: string;
  categoryName: string;
  points: number;
  solvedAgo: string;
  solvedAt: string;
}

interface SolveTimelinePoint {
  date: string;
  points: number;
  cumulative: number;
}

interface PublicProfile {
  id: number;
  username: string;
  memberSince: string;
  teamId?: number;
  teamName?: string;
  totalPoints: number;
  challengesSolved: number;
  totalChallenges: number;
  ranking: number;
  submissionStats: SubmissionStats;
  categoryBreakdown: CategoryBreakdown[];
  recentSolves: RecentSolve[];
  solveTimeline: SolveTimelinePoint[];
}

export default function PublicUserProfile() {
  const router = useRouter();
  const { username } = router.query;
  const { t } = useLanguage();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username || typeof username !== "string") return;

    setLoading(true);
    setError(null);

    axios
      .get(`/api/users/${encodeURIComponent(username)}/profile`)
      .then((res) => {
        setProfile(res.data);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("user_not_found");
        } else {
          setError("error_loading_profile");
        }
      })
      .finally(() => setLoading(false));
  }, [username]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "N/A";
    }
  };

  if (loading) {
    return (
      <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-100/80 via-blue-100/20 to-indigo-100/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-100/80 via-blue-100/20 to-indigo-100/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 flex items-center justify-center">
        <Card className="bg-gradient-to-br from-destructive/20 to-destructive/10 border-destructive/30 max-w-md w-full">
          <CardContent className="p-6 text-center">
            <span className="text-destructive text-lg font-semibold">
              {t(error || "user_not_found")}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submissionPieData = [
    { name: t("correct"), value: profile.submissionStats.correctSubmissions, color: "#22c55e" },
    { name: t("wrong"), value: profile.submissionStats.wrongSubmissions, color: "#ef4444" },
  ];

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-100/80 via-blue-100/20 to-indigo-100/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 p-3 flex flex-col">
      <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 min-h-0 gap-3">
        {/* Profile Header Card */}
        <Card className="bg-gradient-to-br from-card via-muted/50 to-card border border-primary/30 shadow-lg shadow-primary/10 backdrop-blur-sm overflow-hidden relative flex-shrink-0">
          <CardContent className="p-4 text-card-foreground relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent p-0.5 shadow-lg shadow-primary/30">
                  <img src="/logo-no-text.png" alt="Profile Avatar" className="w-full h-full rounded-full object-cover" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{profile.username}</h1>
                  {profile.ranking > 0 && (
                    <Badge className="bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-primary/30 text-xs px-2 py-0.5">
                      <Trophy className="h-3 w-3 mr-1" />#{profile.ranking}
                    </Badge>
                  )}
                  {profile.teamName && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      <Users className="h-3 w-3 mr-1" />{profile.teamName}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{t("member_since")}: {formatDate(profile.memberSince)}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" />{t("points")}
                </div>
                <div className="text-xl font-bold text-foreground">{profile.totalPoints.toLocaleString()}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                  <Target className="h-3 w-3" />{t("challenges_solved")}
                </div>
                <div className="text-xl font-bold text-foreground">{profile.challengesSolved}/{profile.totalChallenges}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                  <Activity className="h-3 w-3" />{t("submissions")}
                </div>
                <div className="text-xl font-bold text-foreground">{profile.submissionStats.totalSubmissions}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                  <Percent className="h-3 w-3" />{t("success_rate")}
                </div>
                <div className="text-xl font-bold text-foreground">{profile.submissionStats.successRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Grid - 2x2 */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          {/* Score Progression */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="p-3 pb-1 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />{t("score_progression")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0">
              {profile.solveTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profile.solveTimeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => {
                      const d = new Date(v);
                      if (v.includes("T")) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }} />
                    <Line type="monotone" dataKey="cumulative" name={t("total_points")} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t("no_solves_yet")}</div>
              )}
            </CardContent>
          </Card>

          {/* Submission Breakdown */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="p-3 pb-1 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-primary" />{t("submission_breakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0">
              {profile.submissionStats.totalSubmissions > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={submissionPieData} cx="50%" cy="45%" innerRadius="35%" outerRadius="65%" paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: "11px" }}>
                      {submissionPieData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t("no_submissions_yet")}</div>
              )}
            </CardContent>
          </Card>

          {/* Categories */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="p-3 pb-1 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />{t("challenges_by_category")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0 overflow-y-auto">
              {profile.categoryBreakdown.length > 0 ? (
                <div className="space-y-2">
                  {profile.categoryBreakdown.map((cat) => (
                    <div key={cat.categoryId}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium">{cat.categoryName}</span>
                        <span className="text-muted-foreground">{cat.solvedCount}/{cat.totalCount}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cat.totalCount > 0 ? (cat.solvedCount / cat.totalCount) * 100 : 0}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t("no_solves_yet")}</div>
              )}
            </CardContent>
          </Card>

          {/* Recent Solves */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="p-3 pb-1 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />{t("recent_solves")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 flex-1 min-h-0 overflow-y-auto">
              {profile.recentSolves.length > 0 ? (
                <div className="space-y-1">
                  {profile.recentSolves.map((solve, idx) => (
                    <div key={`${solve.challengeId}-${idx}`} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{solve.challengeName}</div>
                        <div className="text-[10px] text-muted-foreground">{solve.categoryName} • {solve.solvedAgo}</div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">+{solve.points}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t("no_solves_yet")}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
