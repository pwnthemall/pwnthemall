import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import axios from "@/lib/axios";
import AnimatedText from "./AnimatedText";
import { AnimatedSeparator } from "@/components/ui/animated-separator";
import { Trophy, Target, Award, TrendingUp, Clock, Zap, Users, Flag } from "lucide-react";
import { CTFStatus } from "@/hooks/use-ctf-status";
import { Skeleton } from "@/components/ui/skeleton";

interface IndexContentProps {
  ctfStatus: CTFStatus;
  ctfLoading: boolean;
  isLoggedIn: boolean;
  hasTeam: boolean;
  userRole: string | null;
}

interface DashboardStats {
  totalChallenges: number;
  solvedChallenges: number;
  teamRank: number;
  teamScore: number;
  totalTeams: number;
}

export default function IndexContent({ ctfStatus, ctfLoading, isLoggedIn, hasTeam, userRole }: IndexContentProps) {
  const router = useRouter();
  const { getSiteName } = useSiteConfig();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (isLoggedIn && hasTeam) {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, hasTeam]);

  // Interval-based countdown timer
  useEffect(() => {
    if (!ctfStatus.endTime) {
      setTimeRemaining('');
      return;
    }
    
    const updateCountdown = () => {
      const now = Date.now();
      const end = new Date(ctfStatus.endTime!).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeRemaining(t('ctf.ctf_ended') || 'Ended');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };
    
    updateCountdown(); // Initial calculation
    const interval = setInterval(updateCountdown, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [ctfStatus.endTime, t]);

  const fetchDashboardStats = async () => {
    try {
      // Get current user's team ID first
      const meRes = await axios.get("/api/me");
      const currentTeamId = meRes.data.teamId;

      // Fetch challenges and leaderboard in parallel
      const [challengesRes, leaderboardRes] = await Promise.all([
        axios.get("/api/challenges"),
        axios.get("/api/teams/leaderboard")
      ]);

      const challenges = challengesRes.data || [];
      const leaderboard = leaderboardRes.data || [];
      
      const solvedCount = challenges.filter((c: any) => c.solved).length;
      
      // Find current team in leaderboard (rank is calculated by backend)
      const teamData = leaderboard.find((entry: any) => entry.team.id === currentTeamId);

      setStats({
        totalChallenges: challenges.length,
        solvedChallenges: solvedCount,
        teamRank: teamData?.rank || 0,
        teamScore: teamData?.totalScore || 0,
        totalTeams: leaderboard.length,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn || !hasTeam) {
    return (
      <>
        <Head>
          <title>{getSiteName()}</title>
        </Head>
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="w-full max-w-4xl text-center space-y-8">
            {/* <div className="space-y-4">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                {getSiteName()}
              </h1>
            </div> */}

            {/* <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isLoggedIn ? (
                <>
                  <Button size="lg" onClick={() => router.push("/login")}>
                    {t('dashboard.sign_in')}
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => router.push("/register")}>
                    {t('dashboard.register')}
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={() => router.push("/team")}>
                  {t('dashboard.join_or_create_team')}
                </Button>
              )}
            </div> */}

            {!ctfLoading && ctfStatus.status === 'not_started' && ctfStatus.startTime && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-2 text-orange-700 dark:text-orange-300">
                    <Clock className="h-5 w-5" />
                    <p 
                      className="text-sm font-medium"
                      title={`${t('dashboard.starts_at')} ${new Date(ctfStatus.startTime).toLocaleString()}`}
                    >
                      {t('dashboard.ctf_starts')}: {new Date(ctfStatus.startTime).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{getSiteName()} - {t('admin.dashboard')}</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-start px-4 py-10">
        <div className="w-full max-w-screen-2xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">{t('admin.dashboard')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.ctf_overview')}
            </p>
          </div>

          {/* CTF Status Banner */}
          {!ctfLoading && ctfStatus.status === 'active' && ctfStatus.endTime && (
            <Card className="mb-8 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Zap className="h-5 w-5" />
                    <p className="text-sm font-medium">{t('dashboard.ctf_is_live')}</p>
                  </div>
                  <p 
                    className="text-sm font-semibold text-green-700 dark:text-green-300"
                    title={`${t('dashboard.ends_at')} ${new Date(ctfStatus.endTime).toLocaleString()}`}
                  >
                    {t('dashboard.time_remaining')}: {timeRemaining}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.challenges_solved')}
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {stats?.solvedChallenges} / {stats?.totalChallenges}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats ? Math.round((stats.solvedChallenges / stats.totalChallenges) * 100) : 0}% {t('dashboard.complete')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.team_score')}
                </CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {stats?.teamScore.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.points_earned')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.team_rank')}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
                ) : (
                  <>
                    <div 
                      className="text-2xl font-bold"
                      aria-label={`Team rank: ${stats?.teamRank || 0} out of ${stats?.totalTeams} teams`}
                    >
                      #{stats?.teamRank || "n/a"}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('dashboard.total_teams')}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {stats?.totalTeams}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.competing_now')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <AnimatedSeparator />

          {/* Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Quick Actions Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>{t('dashboard.quick_actions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  onClick={() => router.push('/pwn')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Flag className="h-5 w-5 text-cyan-600 dark:text-cyan-500" />
                  <div>
                    <div className="font-medium">{t('dashboard.browse_challenges')}</div>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/scoreboard')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Trophy className="h-5 w-5 text-cyan-600 dark:text-cyan-500" />
                  <div>
                    <div className="font-medium">{t('dashboard.view_scoreboard')}</div>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/profile/')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-500" />
                  <div>
                    <div className="font-medium">{t('dashboard.view_profile')}</div>
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
