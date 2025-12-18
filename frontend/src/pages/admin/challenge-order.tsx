import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import axios from "@/lib/axios"
import { useAuth } from "@/context/AuthContext"
import { useSiteConfig } from "@/context/SiteConfigContext"
import { useLanguage } from "@/context/LanguageContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChallengeCategory } from "@/models/ChallengeCategory"
import { useChallengeOrder } from "@/hooks/use-challenge-order"
import { DraggableChallengeList } from "@/components/admin/DraggableChallengeList"
import { Challenge } from "@/models/Challenge"
import Head from "next/head"
import { Loader2 } from "lucide-react"

export default function ChallengeOrderPage() {
  const router = useRouter()
  const { loggedIn, checkAuth, authChecked } = useAuth()
  const { getSiteName } = useSiteConfig()
  const { t } = useLanguage()
  const [role, setRole] = useState("")
  const [categories, setCategories] = useState<ChallengeCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const { challenges, loading, fetchChallengesByCategory, reorderChallenges } = useChallengeOrder()

  const fetchCategories = () => {
    axios
      .get<ChallengeCategory[]>("/api/challenge-categories")
      .then((res) => {
        setCategories(res.data)
        if (res.data.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(res.data[0].id)
        }
      })
      .catch(() => setCategories([]))
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
      fetchCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, loggedIn, role, router])

  useEffect(() => {
    if (selectedCategoryId) {
      fetchChallengesByCategory(selectedCategoryId)
    }
  }, [selectedCategoryId, fetchChallengesByCategory])

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(Number(value))
  }

  const handleReorder = async (reorderedChallenges: Challenge[]) => {
    if (!selectedCategoryId) return
    
    const challengeIds = reorderedChallenges.map(c => c.id)
    const success = await reorderChallenges(selectedCategoryId, challengeIds)
    
    // refetch
    if (success) {
      await fetchChallengesByCategory(selectedCategoryId)
    }
  }

  if (!authChecked) return null
  if (!loggedIn || role !== "admin") return null

  return (
    <>
      <Head>
        <title>{t('challenge_order_management')} - {getSiteName()}</title>
      </Head>
      <div className="min-h-screen p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{t('challenge_order_management')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('drag_drop_reorder_description')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('reorder_challenges')}</CardTitle>
            <CardDescription>
              {t('select_category_drag_description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="w-full max-w-xs">
                <label className="text-sm font-medium mb-2 block">
                  {t('select_category')}
                </label>
                <Select
                  value={selectedCategoryId?.toString()}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loading && challenges.length === 0 && selectedCategoryId && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('no_challenges_in_category')}
                </div>
              )}

              {!loading && challenges.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('challenges_count', { count: challenges.length.toString() })}
                  </p>
                  <DraggableChallengeList
                    challenges={challenges}
                    onReorder={handleReorder}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
