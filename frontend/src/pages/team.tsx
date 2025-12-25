import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from "@/lib/axios";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import Head from "next/head";

export default function TeamPage() {
  const { t } = useLanguage();
  const { getSiteName } = useSiteConfig();
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const [teamChecked, setTeamChecked] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authChecked && !loggedIn) {
      router.replace("/login");
    } else if (authChecked && loggedIn) {
      axios
        .get("/api/me")
        .then((res) => {
          if (res.data.teamId) {
            setHasTeam(true);
            router.replace("/");
          } else {
            setHasTeam(false);
          }
          setTeamChecked(true);
        })
        .catch(() => {
          setTeamChecked(true);
        });
    }
  }, [authChecked, loggedIn, router]);

  if (!authChecked || !teamChecked) return null;
  if (!loggedIn) return null;
  if (hasTeam) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation with toast messages
    if (!createName || createName.trim() === "") {
      toast.error(t("team_name_required") || "Team name is required", { className: "bg-red-600 text-white" });
      return;
    }
    
    if (!createPassword) {
      toast.error(t("password_required") || "Password is required", { className: "bg-red-600 text-white" });
      return;
    }
    
    if (createPassword.length < 8) {
      toast.error(t("password_too_short"), { className: "bg-red-600 text-white" });
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post("/api/teams", {
        name: createName,
        password: createPassword,
      });

      if (!res || !res.data) throw new Error(t("invalid_server_response"));

      if (res.data.error) throw new Error(t(res.data.error) || t("team_creation_failed"));

      toast.success(t("team_created_success"));
      router.push("/");
    } catch (err: any) {
      const errorMessage = err.response?.data?.error 
        ? t(err.response.data.error) 
        : err.message || t("team_creation_failed");
      toast.error(errorMessage, { className: "bg-red-600 text-white" });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName || !joinPassword) return;
    setLoading(true);
    try {
      const res = await axios.post("/api/teams/join", {
        name: joinName,
        password: joinPassword,
      });

      if (!res || !res.data) throw new Error(t("invalid_server_response"));
      if (res.data.error) throw new Error(t(res.data.error) || t("team_join_failed"));

      toast.success(t("team_joined_success"));
      router.push("/");
    } catch (err: any) {
      const errorMessage = err.response?.data?.error 
        ? t(err.response.data.error) 
        : err.message || t("team_join_failed");
      toast.error(errorMessage, { className: "bg-red-600 text-white" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
    <div className="min-h-screen flex items-center justify-center px-2 py-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-8">
          <CardTitle className="text-center text-3xl font-bold mb-2">{t("team")}</CardTitle>
          <p className="text-center text-muted-foreground mb-8">{t("team_access_required")}</p>
          <div className="flex flex-col md:flex-row gap-8 justify-center">
            <form onSubmit={handleCreate} className="flex-1 min-w-[220px] space-y-3">
              <h2 className="text-xl font-semibold mb-2 text-center">{t("create_team")}</h2>
              <Input
                type="text"
                placeholder={t("team_name")}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={32}
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                maxLength={72}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t("creating") : t("team.create")}
              </Button>
            </form>
            <form onSubmit={handleJoin} className="flex-1 min-w-[220px] space-y-3">
              <h2 className="text-xl font-semibold mb-2 text-center">{t("join_team")}</h2>
              <Input
                type="text"
                placeholder={t("team_name_or_id")}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                required
                maxLength={32}
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                required
                maxLength={72}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t("joining") : t("join")}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
