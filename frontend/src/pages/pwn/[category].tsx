import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCTFStatus } from "@/hooks/use-ctf-status";
import CategoryContent from "@/components/pwn/CategoryContent";
import { Challenge } from "@/models/Challenge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import Head from "next/head";
import axios from "@/lib/axios";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"

export default function CategoryPage() {
  const router = useRouter();
  const { category } = router.query;
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const { getSiteName } = useSiteConfig();
  const { t } = useLanguage();
  const { ctfStatus, loading: ctfLoading } = useCTFStatus();

  const cat = Array.isArray(category) ? category[0] : category;

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [teamChecked, setTeamChecked] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authChecked && !loggedIn) {
      router.replace("/login");
    }
  }, [authChecked, loggedIn, router]);

  useEffect(() => {
    if (authChecked && loggedIn) {
      axios.get("/api/me").then(res => {
        setRole(res.data.role);
        if (res.data.teamId) {
          setHasTeam(true);
        } else {
          setHasTeam(false);
          if (res.data.role !== "admin") {
            router.replace("/team");
          }
        }
        setTeamChecked(true);
      }).catch(() => {
        router.replace("/login");
      });
    }
  }, [authChecked, loggedIn, router]);

  const fetchChallenges = useCallback(async () => {
    if (!authChecked || !loggedIn || (!hasTeam && role !== "admin") || !cat) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get<Challenge[]>(`/api/challenges/category/${cat}`);
      setChallenges(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load challenges');
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [authChecked, loggedIn, hasTeam, role, cat]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  useEffect(() => {
    // Listen to websocket events via NotificationContext custom event bus
    const handler = (e: any) => {
      try {
        const data = e?.detail ?? (typeof e?.data === 'string' ? JSON.parse(e.data) : e?.data);
        if (data && data.event === 'team_solve') {

          // Instantly update local state to mark the challenge as solved if it's in the current list
          let foundInList = false;
          setChallenges((prev) => {
            const exists = prev.some((c) => c.id === data.challengeId);
            if (!exists) return prev;
            foundInList = true;
            return prev.map((c) => (c.id === data.challengeId ? { ...c, solved: true } : c));
          });

          // If the challenge isn't in the current list (different category/page), skip.
          // If it is but you still want to ensure server truth, you can optionally refetch:
          if (!foundInList) {
            // Not in this category, ignore. If you prefer, you could trigger a lightweight refresh here.
            return;
          }

          // Refresh to update dynamic points (decay)
          fetchChallenges();
        }
      } catch (err) {
        console.warn('[TeamSolve] failed to parse event', err);
      }
    };

    window.addEventListener?.('team-solve', handler as EventListener);
    return () => {
      window.removeEventListener?.('team-solve', handler as EventListener);
    };
  }, [cat]);

  if (!authChecked || !loggedIn || !teamChecked) return null;
  if (!hasTeam && role !== "admin") return null;
  if (!cat) {
    return <div>Invalid category</div>;
  }
  if (loading) {
    return (
    <div className="flex w-full min-h-screen items-center justify-center">
      <div className="w-full max-w-xs flex flex-col gap-4 [--radius:1rem]">
        <Item variant="muted" className="flex items-center">
          <ItemMedia>
            <Spinner />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="line-clamp-1">Loading challenges</ItemTitle>
          </ItemContent>
        </Item>
      </div>
    </div>
    );
  }
  if (error) {
    return <div>Error: {error}</div>;
  }

  // CTF Status Blocking - Redirect when CTF hasn't started
  if (!ctfLoading && ctfStatus.status === 'not_started') {
    router.replace('/');
    return null;
  }

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
      <CategoryContent cat={cat} challenges={challenges} onChallengeUpdate={fetchChallenges} ctfStatus={ctfStatus} ctfLoading={ctfLoading} />
    </>
  );
}
