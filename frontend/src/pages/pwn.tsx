import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCTFStatus } from "@/hooks/use-ctf-status";
import axios from "@/lib/axios";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users } from "lucide-react";

const PwnPage = () => {
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const { getSiteName } = useSiteConfig();
  const { t } = useLanguage();
  const { ctfStatus, loading: ctfLoading } = useCTFStatus();
  const [teamChecked, setTeamChecked] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

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

  if (!authChecked || !loggedIn || !teamChecked) return null;
  if (!hasTeam && role !== "admin") return null;

  const formatDateTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

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
    <main className="bg-muted flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1 className="text-3xl font-bold mb-4">
          {t('choose_a_category')}
      </h1>
    </main>
    </>
  );
};

export default PwnPage;
