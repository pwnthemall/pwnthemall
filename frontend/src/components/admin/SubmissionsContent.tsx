import Head from "next/head"
import { useState, useMemo, useEffect } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { useSiteConfig } from "@/context/SiteConfigContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"

interface Submission {
  id: number
  value: string
  isCorrect: boolean
  createdAt: string
  user?: { 
    id: number
    username: string
    team?: {
      id: number
      name: string
    }
  }
  challenge?: { id: number; name: string }
}

interface SubmissionsContentProps {
  readonly submissions: Submission[]
  readonly onRefresh: () => void
}

export default function SubmissionsContent({ submissions, onRefresh }: SubmissionsContentProps) {
  const { t } = useLanguage()
  const { getSiteName } = useSiteConfig()
  const [userFilter, setUserFilter] = useState("")
  const [teamFilter, setTeamFilter] = useState("")
  const [challengeFilter, setChallengeFilter] = useState("")

  // Filter submissions based on user, team, and challenge
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return []
    return submissions.filter((submission) => {
      const userMatch = !userFilter || 
        submission.user?.username?.toLowerCase().includes(userFilter.toLowerCase())
      
      const teamMatch = !teamFilter || 
        submission.user?.team?.name?.toLowerCase().includes(teamFilter.toLowerCase())
      
      const challengeMatch = !challengeFilter || 
        submission.challenge?.name?.toLowerCase().includes(challengeFilter.toLowerCase())
      
      return userMatch && teamMatch && challengeMatch
    })
  }, [submissions, userFilter, teamFilter, challengeFilter])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 16

  // Get current page data and pad to 16 rows
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    const pageData = filteredSubmissions.slice(start, end)
    
    // Pad with empty rows to always have 16 rows
    const emptyRowsNeeded = pageSize - pageData.length
    const emptyRows = new Array(emptyRowsNeeded).fill(null).map((_, i) => ({
      id: -(start + pageData.length + i + 1),
      value: "",
      isCorrect: false,
      createdAt: "",
      user: undefined,
      challenge: undefined,
    }))
    
    return [...pageData, ...emptyRows]
  }, [filteredSubmissions, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize))

    // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(0)
  }, [userFilter, teamFilter, challengeFilter])

  const hasActiveFilters = userFilter || teamFilter || challengeFilter

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
      <div className="min-h-screen p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("admin.submissions") || "Submissions"}</h1>
          <div>
            <Button size="sm" onClick={onRefresh}>{t("refresh") || "Refresh"}</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2 items-end bg-card p-4 rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("username") || "User"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("search_users") || "Filter by user..."}
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {userFilter && (
                <button
                  onClick={() => setUserFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("team") || "Team"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("search_teams") || "Filter by team..."}
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {teamFilter && (
                <button
                  onClick={() => setTeamFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("challenge.challenge") || "Challenge"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("search_challenges") || "Filter by challenge..."}
                value={challengeFilter}
                onChange={(e) => setChallengeFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {challengeFilter && (
                <button
                  onClick={() => setChallengeFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUserFilter("")
                setTeamFilter("")
                setChallengeFilter("")
              }}
              className="mb-0.5"
            >
              {t("clear") || "Clear"} {t("all") || "All"}
            </Button>
          )}
        </div>

        <div className="bg-background rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="border-b">
                <tr>
                  <th className="w-[180px] px-3 py-1.5 text-left font-medium align-middle">{t("username") || "User"}</th>
                  <th className="w-[180px] px-3 py-1.5 text-left font-medium align-middle">{t("team") || "Team"}</th>
                  <th className="w-[220px] px-3 py-1.5 text-left font-medium align-middle">{t("challenge.challenge") || "Challenge"}</th>
                  <th className="w-[150px] px-3 py-1.5 text-left font-medium align-middle">{t("value") || "Value"}</th>
                  <th className="w-[100px] px-3 py-1.5 text-left font-medium align-middle">{t("result") || "Result"}</th>
                  <th className="w-[170px] px-3 py-1.5 text-left font-medium align-middle">{t("time") || "Time"}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((submission) => (
                  <tr key={submission.id} className="border-b last:border-b-0">
                    <td className="w-[180px] px-3 py-2 align-middle truncate">
                      {submission.id >= 0 ? (
                        submission.user?.username || "-"
                      ) : (
                        <div className="h-[22px]">&nbsp;</div>
                      )}
                    </td>
                    <td className="w-[180px] px-3 py-2 align-middle truncate">
                      {submission.id >= 0 ? (
                        submission.user?.team?.name || "-"
                      ) : (
                        <div className="h-[22px]">&nbsp;</div>
                      )}
                    </td>
                    <td className="w-[220px] px-3 py-2 align-middle truncate">
                      {submission.id >= 0 ? (
                        submission.challenge?.name || "-"
                      ) : (
                        <div className="h-[22px]">&nbsp;</div>
                      )}
                    </td>
                    <td className="w-[150px] px-3 py-2 align-middle font-mono text-muted-foreground truncate">
                      {submission.id >= 0 ? (
                        submission.value || "-"
                      ) : (
                        <div className="h-[22px]">&nbsp;</div>
                      )}
                    </td>
                    <td className="w-[100px] px-3 py-2 align-middle">
                      {submission.id >= 0 ? (
                        <Badge variant={submission.isCorrect ? "default" : "destructive"} className="text-xs">
                          {submission.isCorrect ? (t("dashboard.correct") || "Correct") : (t("dashboard.incorrect") || "Incorrect")}
                        </Badge>
                      ) : (
                        <div className="h-[22px]">&nbsp;</div>
                      )}
                    </td>
                    <td className="w-[170px] px-3 py-2 align-middle text-muted-foreground">
                      {submission.id >= 0 ? (
                        new Date(submission.createdAt).toLocaleString()
                      ) : (
                        <div className="h-[22px]">&nbsp;</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Fixed Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
