import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useCTFStatus } from "@/hooks/use-ctf-status";
import axios from "@/lib/axios";
import IndexContent from '@/components/pages/IndexContent';

export default function Home() {
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const { ctfStatus, loading: ctfLoading } = useCTFStatus();
  const [teamChecked, setTeamChecked] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!authChecked) {
      checkAuth();
    }
  }, [authChecked, checkAuth]);

  useEffect(() => {
    if (authChecked && loggedIn && !teamChecked) {
      axios.get("/api/me")
        .then(res => {
          setRole(res.data.role);
          if (res.data.teamId) {
            setHasTeam(true);
          } else if (res.data.role !== "admin") {
            router.replace("/team");
          } else {
            // Admin doesn't need a team
            setHasTeam(true);
          }
        })
        .catch(() => {
          setTeamChecked(true);
        })
        .finally(() => {
          setTeamChecked(true);
        });
    } else if (authChecked && !loggedIn) {
      router.replace("/pages/index");
    }
  }, [authChecked, loggedIn, teamChecked, router]);

  if (!teamChecked) return null;
  if (loggedIn && !hasTeam && role !== "admin") return null;

  return <IndexContent ctfStatus={ctfStatus} ctfLoading={ctfLoading} isLoggedIn={loggedIn} hasTeam={hasTeam} userRole={role} />;
}
