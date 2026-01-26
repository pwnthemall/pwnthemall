import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useCTFStatus } from "@/hooks/use-ctf-status";
import axios from "@/lib/axios";
import Head from "next/head";
import CategoryContent from "@/components/pwn/CategoryContent";
import type { Challenge } from "@/models/Challenge";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";

const PwnPage = () => {
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const { getSiteName } = useSiteConfig();
  const { ctfStatus, loading: ctfLoading } = useCTFStatus();
  const [teamChecked, setTeamChecked] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
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

  const fetchChallenges = useCallback(async (silent = false) => {
    if (!authChecked || !loggedIn || (!hasTeam && role !== "admin")) return;

    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await axios.get<Challenge[]>("/api/challenges");
      setChallenges(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load challenges");
      setChallenges([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authChecked, loggedIn, hasTeam, role]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Real-time: update solve status in list
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const data = e?.detail ?? (typeof e?.data === "string" ? JSON.parse(e.data) : e?.data);
        if (!data || data.event !== "team_solve") return;

        let foundInList = false;
        setChallenges((prev) => {
          const exists = prev.some((c) => c.id === data.challengeId);
          if (!exists) return prev;
          foundInList = true;
          return prev.map((c) => (c.id === data.challengeId ? { ...c, solved: true } : c));
        });

        if (foundInList) {
          fetchChallenges(true);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener?.("team-solve", handler as EventListener);
    return () => {
      window.removeEventListener?.("team-solve", handler as EventListener);
    };
  }, [fetchChallenges]);

  const initialCategory = useMemo(() => {
    const raw = router.query.category;
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  }, [router.query.category]);

  const handleSilentUpdate = useCallback(() => {
    fetchChallenges(true);
  }, [fetchChallenges]);

  if (!authChecked || !loggedIn || !teamChecked) return null;
  if (!hasTeam && role !== "admin") return null;

  // Redirect to main page only when CTF hasn't started
  if (!ctfLoading && ctfStatus.status === 'not_started') {
    router.replace('/');
    return null;
  }

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
      {loading ? (
        <CategoryContent
          cat="Challenges"
          challenges={[]}
          onChallengeUpdate={handleSilentUpdate}
          ctfStatus={ctfStatus}
          ctfLoading={ctfLoading}
          initialCategory={initialCategory}
          loading={true}
        />
      ) : error ? (
        <main className="flex min-h-screen items-center justify-center px-6">
          <p className="text-sm text-destructive">{error}</p>
        </main>
      ) : (
        <CategoryContent
          cat="Challenges"
          challenges={challenges}
          onChallengeUpdate={handleSilentUpdate}
          ctfStatus={ctfStatus}
          ctfLoading={ctfLoading}
          initialCategory={initialCategory}
          loading={false}
        />
      )}
    </>
  );
};

export default PwnPage;
