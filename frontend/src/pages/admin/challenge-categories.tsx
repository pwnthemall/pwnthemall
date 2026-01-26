import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import axios from "@/lib/axios";
import { useAuth } from "@/context/AuthContext"
import Head from "next/head"
import { ChallengeCategory } from "@/models/ChallengeCategory"
import { ChallengeDifficulty } from "@/models/ChallengeDifficulty"
import ChallengeCategoriesContent from "@/components/admin/ChallengeCategoriesContent"
import ChallengeDifficultiesContent from "@/components/admin/ChallengeDifficultiesContent"
import { useSiteConfig } from "@/context/SiteConfigContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ChallengeCategoriesPage() {
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const { getSiteName } = useSiteConfig();
  const [role, setRole] = useState("");
  const [challengeCategories, setChallengeCategories] = useState<ChallengeCategory[]>([])
  const [challengeDifficulties, setChallengeDifficulties] = useState<ChallengeDifficulty[]>([])

  const fetchChallengeCategories = () => {
    axios
      .get<ChallengeCategory[]>("/api/challenge-categories")
      .then((res) => setChallengeCategories(res.data))
      .catch(() => setChallengeCategories([]))
  }

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
      fetchChallengeCategories()
      fetchChallengeDifficulties()
    }
  }, [authChecked, loggedIn, role, router]);

  if (!authChecked) return null;
  if (!loggedIn || role !== "admin") return null;

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold mb-4">Categories & Difficulties</h1>
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="difficulties">Difficulties</TabsTrigger>
          </TabsList>
          <TabsContent value="categories">
            <ChallengeCategoriesContent
              challengeCategories={challengeCategories}
              onRefresh={fetchChallengeCategories}
            />
          </TabsContent>
          <TabsContent value="difficulties">
            <ChallengeDifficultiesContent
              challengeDifficulties={challengeDifficulties}
              onRefresh={fetchChallengeDifficulties}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
