import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { TeamChat } from "@/components/team/TeamChat";
import axios from "@/lib/axios";
import Head from "next/head";
import { Loader2 } from "lucide-react";

interface UserData {
  id: number;
  username: string;
  teamId?: number;
  team?: {
    id: number;
    name: string;
  };
}

export default function TeamChatPage() {
  const { t } = useLanguage();
  const { getSiteName } = useSiteConfig();
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authChecked && !loggedIn) {
      router.replace("/login");
    } else if (authChecked && loggedIn) {
      fetchUserData();
    }
  }, [authChecked, loggedIn, router]);

  const fetchUserData = async () => {
    try {
      const res = await axios.get<UserData>("/api/me");
      setUserData(res.data);

      if (!res.data.teamId) {
        router.replace("/team");
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loggedIn || !userData || !userData.teamId || !userData.team) {
    return null;
  }

  return (
    <>
      <Head>
        <title>
          {t("team.chat") || "Team Chat"} - {getSiteName()}
        </title>
      </Head>
      <div className="container mx-auto p-4 h-[calc(100vh-4rem)]">
        <TeamChat teamId={userData.teamId} teamName={userData.team.name} />
      </div>
    </>
  );
}
