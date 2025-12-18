import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import axios from "@/lib/axios";
import { useAuth } from "@/context/AuthContext"
import ChallengeDifficultiesContent from "@/components/admin/ChallengeDifficultiesContent"
import { ChallengeDifficulty } from "@/models/ChallengeDifficulty"

export default function ChallengeDifficultiesPage() {
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const [role, setRole] = useState("");
  const [challengeDifficulties, setChallengeDifficulties] = useState<ChallengeDifficulty[]>([])

  const fetchChallengeDifficulties = () => {
    axios
      .get<ChallengeDifficulty[]>("/api/challenge-difficulties")
      .then((res) => setChallengeDifficulties(res.data))
      .catch(() => setChallengeDifficulties([]))
  }

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authChecked && loggedIn) {
      axios
        .get("/api/me")
        .then((res) => setRole(res.data.role))
        .catch(() => setRole(""));
    }
  }, [authChecked, loggedIn]);

  useEffect(() => {
    if (!authChecked) return;
    if (!loggedIn) {
      router.replace("/login");
    } else if (role && role !== "admin") {
      router.replace("/pwn");
    } else if (role === "admin") {
      fetchChallengeDifficulties()
    }
  }, [authChecked, loggedIn, role, router]);

  if (!authChecked) return null;
  if (!loggedIn || role !== "admin") return null;

  return (
    <ChallengeDifficultiesContent
      challengeDifficulties={challengeDifficulties}
      onRefresh={fetchChallengeDifficulties}
    />
  )
}
