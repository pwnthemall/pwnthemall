import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import axios from "@/lib/axios"
import { useAuth } from "@/context/AuthContext"
import { useSiteConfig } from "@/context/SiteConfigContext"
import { useLanguage } from "@/context/LanguageContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Challenge } from "@/models/Challenge"
import Head from "next/head"
import { Check, X, Search } from "lucide-react"
import { toast } from "sonner"

interface FeaturedConfig {
  id?: number
  mode: "manual" | "most_solved" | "highest_points" | "active_first_blood"
  challengeIds: number[]
}

export default function FeaturedChallengesPage() {
  const router = useRouter()
  const { loggedIn, checkAuth, authChecked } = useAuth()
  const { getSiteName } = useSiteConfig()
  const { t } = useLanguage()
  const [role, setRole] = useState("")

  // Featured challenges state
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([])
  const [featuredConfig, setFeaturedConfig] = useState<FeaturedConfig>({
    mode: "highest_points",
    challengeIds: [],
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (authChecked && loggedIn) {
      axios
        .get("/api/me")
        .then((res) => setRole(res.data.role))
        .catch(() => setRole(""))
    }
  }, [authChecked, loggedIn])

  useEffect(() => {
    if (!authChecked) return
    if (!loggedIn) {
      router.replace("/login")
    } else if (role && role !== "admin") {
      router.replace("/pwn")
    } else if (role === "admin") {
      fetchFeaturedConfig()
      fetchAllChallenges()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, loggedIn, role, router])

  const fetchFeaturedConfig = async () => {
    try {
      const res = await axios.get<FeaturedConfig>("/api/admin/featured-challenges")
      setFeaturedConfig(res.data)
    } catch (error) {
      console.error("Failed to fetch featured config:", error)
    }
  }

  const fetchAllChallenges = async () => {
    try {
      const res = await axios.get<Challenge[]>("/api/admin/challenges")
      setAllChallenges(res.data.filter((c) => !c.hidden))
    } catch (error) {
      console.error("Failed to fetch challenges:", error)
    }
  }

  const handleSaveFeatured = async () => {
    if (featuredConfig.mode === "manual" && featuredConfig.challengeIds.length === 0) {
      toast.error(t("featured_challenges.no_challenges_selected"))
      return
    }

    setSaving(true)
    try {
      await axios.post("/api/admin/featured-challenges", {
        mode: featuredConfig.mode,
        challengeIds: featuredConfig.challengeIds,
      })
      toast.success(t("featured_challenges.configuration_saved"))
    } catch (error) {
      console.error("Failed to save config:", error)
      toast.error(t("featured_challenges.failed_to_save_configuration"))
    } finally {
      setSaving(false)
    }
  }

  const toggleChallenge = (challengeId: number) => {
    setFeaturedConfig((prev) => {
      const ids = [...prev.challengeIds]
      const index = ids.indexOf(challengeId)

      if (index > -1) {
        ids.splice(index, 1)
      } else {
        if (ids.length >= 3) {
          toast.error("Maximum 3 challenges allowed")
          return prev
        }
        ids.push(challengeId)
      }

      return { ...prev, challengeIds: ids }
    })
  }

  const filteredChallenges = allChallenges.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.challengeCategory?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedChallenges = allChallenges.filter((c) =>
    featuredConfig.challengeIds.includes(c.id)
  )

  if (!authChecked) return null
  if (!loggedIn || role !== "admin") return null

  return (
    <>
      <Head>
        <title>{t('featured_challenges.featured_challenges_management')} - {getSiteName()}</title>
      </Head>
      <div className="min-h-screen p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{t('featured_challenges.featured_challenges_management')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('featured_challenges.featured_challenges_description')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('featured_challenges.featured_challenges_management')}</CardTitle>
            <CardDescription>
              {t('featured_challenges.featured_challenges_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                {t("featured_challenges.selection_mode")}
              </Label>
              <RadioGroup
                value={featuredConfig.mode}
                onValueChange={(value: any) =>
                  setFeaturedConfig({ ...featuredConfig, mode: value, challengeIds: [] })
                }
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="highest_points" id="highest_points" />
                  <div className="flex-1">
                    <Label htmlFor="highest_points" className="font-medium cursor-pointer">
                      {t("featured_challenges.mode_highest_points")}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("featured_challenges.mode_highest_points_description")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="most_solved" id="most_solved" />
                  <div className="flex-1">
                    <Label htmlFor="most_solved" className="font-medium cursor-pointer">
                      {t("featured_challenges.mode_most_solved")}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("featured_challenges.mode_most_solved_description")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="active_first_blood" id="active_first_blood" />
                  <div className="flex-1">
                    <Label htmlFor="active_first_blood" className="font-medium cursor-pointer">
                      {t("featured_challenges.mode_active_first_blood")}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("featured_challenges.mode_active_first_blood_description")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="manual" id="manual" />
                  <div className="flex-1">
                    <Label htmlFor="manual" className="font-medium cursor-pointer">
                      {t("featured_challenges.mode_manual")}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("featured_challenges.mode_manual_description")}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {featuredConfig.mode === "manual" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">
                    {t("featured_challenges.select_challenges")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("featured_challenges.selected_challenges")}
                  </p>
                </div>

                {selectedChallenges.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedChallenges.map((challenge) => (
                      <Badge
                        key={challenge.id}
                        variant="secondary"
                        className="text-sm py-1.5 px-3 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        onClick={() => toggleChallenge(challenge.id)}
                      >
                        {challenge.name}
                        <X className="ml-2 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("featured_challenges.search_challenges")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="border rounded-md max-h-96 overflow-y-auto">
                  {filteredChallenges.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t("no_challenges_found")}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredChallenges.map((challenge) => {
                        const isSelected = featuredConfig.challengeIds.includes(challenge.id)
                        return (
                          <button
                            type="button"
                            key={challenge.id}
                            className={`w-full flex items-center justify-between p-3 hover:bg-accent cursor-pointer transition-colors ${
                              isSelected ? "bg-accent" : ""
                            }`}
                            onClick={() => toggleChallenge(challenge.id)}
                          >
                            <div className="flex-1">
                              <div className="font-medium">{challenge.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {challenge.challengeCategory?.name || "N/A"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {challenge.points} pts
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleSaveFeatured} disabled={saving} className="w-full">
              {saving ? "Saving..." : t("featured_challenges.save_configuration")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
