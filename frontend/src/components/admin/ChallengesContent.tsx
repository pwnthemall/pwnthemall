import Head from "next/head"
import { useState, useMemo, useEffect } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { Challenge } from "@/models/Challenge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Plus, Search, ArrowUpDown, Download } from "lucide-react"
import ChallengeAdminForm from "./ChallengeAdminForm"
import ChallengeCreateDialog from "./ChallengeCreateDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import axios from "@/lib/axios"

interface ChallengesContentProps {
  challenges: Challenge[]
  onRefresh: () => void
}

export default function ChallengesContent({ challenges, onRefresh }: ChallengesContentProps) {
  const { t } = useLanguage()
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterDifficulty, setFilterDifficulty] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 11

  // Get unique values for filters
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(challenges.map(c => c.challengeCategory?.name).filter(Boolean)))
    return uniqueCategories.sort((a, b) => a.localeCompare(b))
  }, [challenges])

  const difficulties = useMemo(() => {
    const uniqueDifficulties = Array.from(new Set(challenges.map(c => c.challengeDifficulty?.name).filter(Boolean)))
    return uniqueDifficulties.sort((a, b) => a.localeCompare(b))
  }, [challenges])

  // Handle challenge created - just refresh the list
  const handleChallengeCreated = async (challengeId: number) => {
    onRefresh() // Refresh the list to show the new challenge
  }

  // Filter and sort challenges
  const filteredAndSortedChallenges = useMemo(() => {
    let filtered = challenges.filter(challenge => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        challenge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        challenge.challengeCategory?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        challenge.challengeType?.name.toLowerCase().includes(searchTerm.toLowerCase())

      // Category filter
      const matchesCategory = filterCategory === "all" || challenge.challengeCategory?.name === filterCategory

      // Difficulty filter
      const matchesDifficulty = filterDifficulty === "all" || challenge.challengeDifficulty?.name === filterDifficulty

      // Status filter
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "visible" && !challenge.hidden) ||
        (filterStatus === "hidden" && challenge.hidden)

      return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus
    })

    // Sort challenges
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case "name":
          aValue = a.name
          bValue = b.name
          break
        case "challengeCategory":
          aValue = a.challengeCategory?.name || ""
          bValue = b.challengeCategory?.name || ""
          break
        case "challengeDifficulty":
          aValue = a.challengeDifficulty?.name || ""
          bValue = b.challengeDifficulty?.name || ""
          break
        case "points":
          aValue = a.points
          bValue = b.points
          break
        case "challengeType":
          aValue = a.challengeType?.name || ""
          bValue = b.challengeType?.name || ""
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue, 'en', { sensitivity: 'base' })
        return sortOrder === "asc" ? comparison : -comparison
      } else {
        const comparison = aValue - bValue
        return sortOrder === "asc" ? comparison : -comparison
      }
    })

    return filtered
  }, [challenges, searchTerm, sortBy, sortOrder, filterCategory, filterDifficulty, filterStatus])

  // Paginated challenges with empty rows to fill the page
  const paginatedChallenges = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const pageData = filteredAndSortedChallenges.slice(startIndex, endIndex)
    
    // Add empty rows to fill the page
    const emptyRowsNeeded = itemsPerPage - pageData.length
    if (emptyRowsNeeded > 0) {
      const emptyRows = new Array(emptyRowsNeeded).fill(null).map((_, index) => ({
        id: -(index + 1),
        name: "",
        slug: "",
        description: "",
        points: 0,
        hidden: false,
        challengeCategory: null as any,
        challengeCategoryId: 0,
        challengeType: null as any,
        challengeTypeId: 0,
        challengeDifficulty: null as any,
        challengeDifficultyId: 0,
        author: "",
        enableFirstBlood: false,
      } as Challenge))
      return [...pageData, ...emptyRows]
    }
    
    return pageData
  }, [filteredAndSortedChallenges, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredAndSortedChallenges.length / itemsPerPage)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterCategory, filterDifficulty, filterStatus])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const handleEdit = (challenge: Challenge) => {
    setSelectedChallenge(challenge)
    setIsDialogOpen(true)
  }

  const handleClose = () => {
    setSelectedChallenge(null)
    setIsDialogOpen(false)
    onRefresh()
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "hard":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (hidden: boolean) => {
    return hidden ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
  }

  return (
    <>
      <Head>
        <title>{t('admin_challenges.challenge_management')}</title>
      </Head>
      <div className="bg-muted min-h-screen p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('admin_challenges.challenge_management')}</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin_challenges.create_challenge') || 'Create Challenge'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin_challenges.all_challenges')}</CardTitle>
            <CardDescription>
              {t('admin_challenges.manage_challenge_configurations')}
            </CardDescription>
            
            {/* Search and Filter Section */}
            <div className="space-y-4 pt-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t('admin_challenges.search_challenges_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin_challenges.all_categories')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin_challenges.all_categories')}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin_challenges.all_difficulties')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin_challenges.all_difficulties')}</SelectItem>
                    {difficulties.map((difficulty) => (
                      <SelectItem key={difficulty} value={difficulty}>
                        {difficulty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin_challenges.all_status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin_challenges.all_status')}</SelectItem>
                    <SelectItem value="visible">{t('admin_challenges.visible')}</SelectItem>
                    <SelectItem value="hidden">{t('admin_challenges.hidden')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-')
                  setSortBy(field)
                  setSortOrder(order as "asc" | "desc")
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin_challenges.sort_by')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">{t('admin_challenges.name_asc')}</SelectItem>
                    <SelectItem value="name-desc">{t('admin_challenges.name_desc')}</SelectItem>
                    <SelectItem value="category-asc">{t('admin_challenges.category_asc')}</SelectItem>
                    <SelectItem value="category-desc">{t('admin_challenges.category_desc')}</SelectItem>
                    <SelectItem value="difficulty-asc">{t('admin_challenges.difficulty_asc')}</SelectItem>
                    <SelectItem value="difficulty-desc">{t('admin_challenges.difficulty_desc')}</SelectItem>
                    <SelectItem value="points-asc">{t('admin_challenges.points_low_high')}</SelectItem>
                    <SelectItem value="points-desc">{t('admin_challenges.points_high_low')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr>
                  <th className="w-[280px] px-3 py-1.5 text-left font-medium align-middle">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort("name")}
                    >
                      {t('admin_challenges.name')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="w-[120px] px-3 py-1.5 text-left font-medium align-middle">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort("challengeCategory")}
                    >
                      {t('admin_challenges.category')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="w-[120px] px-3 py-1.5 text-left font-medium align-middle">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort("challengeType")}
                    >
                      {t('admin_challenges.type')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="w-[120px] px-3 py-1.5 text-left font-medium align-middle">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort("challengeDifficulty")}
                    >
                      {t('admin_challenges.difficulty')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="w-[100px] px-3 py-1.5 text-left font-medium align-middle">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort("points")}
                    >
                      {t('admin_challenges.points')}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </th>
                  <th className="w-[120px] px-3 py-1.5 text-left font-medium align-middle">{t('admin_challenges.first_blood')}</th>
                  <th className="w-[100px] px-3 py-1.5 text-left font-medium align-middle">{t('admin_challenges.status')}</th>
                  <th className="w-[100px] px-3 py-1.5 text-left font-medium align-middle">{t('admin_challenges.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedChallenges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      {t('admin_challenges.no_challenges_found')}
                    </td>
                  </tr>
                ) : (
                  paginatedChallenges.map((challenge) => (
                    <tr key={challenge.id} className="border-b last:border-b-0">
                      <td className="w-[280px] px-3 py-2 align-middle font-medium truncate">
                        {challenge.id >= 0 ? (
                          challenge.name
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[120px] px-3 py-2 align-middle truncate">
                        {challenge.id >= 0 ? (
                          challenge.challengeCategory?.name || "N/A"
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[120px] px-3 py-2 align-middle truncate">
                        {challenge.id >= 0 ? (
                          challenge.challengeType?.name || "N/A"
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[120px] px-3 py-2 align-middle">
                        {challenge.id >= 0 ? (
                          <Badge className={getDifficultyColor(challenge.challengeDifficulty?.name || "")}>
                            {challenge.challengeDifficulty?.name || "N/A"}
                          </Badge>
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[100px] px-3 py-2 align-middle">
                        {challenge.id >= 0 ? (
                          challenge.points
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[120px] px-3 py-2 align-middle">
                        {challenge.id >= 0 ? (
                          <Badge variant={challenge.enableFirstBlood ? "default" : "secondary"}>
                            {challenge.enableFirstBlood ? t('admin_challenges.enabled') : t('admin_challenges.disabled')}
                          </Badge>
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[100px] px-3 py-2 align-middle">
                        {challenge.id >= 0 ? (
                          <Badge className={getStatusColor(challenge.hidden ?? false)}>
                            {challenge.hidden ? t('admin_challenges.hidden') : t('admin_challenges.visible')}
                          </Badge>
                        ) : (
                          <div className="h-[22px]">&nbsp;</div>
                        )}
                      </td>
                      <td className="w-[140px] px-3 py-2 align-middle">
                        {challenge.id >= 0 ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(challenge)}
                              title={t('admin_challenges.edit')}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              title={t('admin_challenges.export') || 'Export'}
                            >
                              <a href={`/api/admin/challenges/${challenge.id}/export`}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <div className="h-[32px]">&nbsp;</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="text-sm text-muted-foreground">
                {t('admin_challenges.showing_x_to_y_of_z', { 
                  from: (currentPage - 1) * itemsPerPage + 1, 
                  to: Math.min(currentPage * itemsPerPage, filteredAndSortedChallenges.length), 
                  total: filteredAndSortedChallenges.length 
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t('common.previous')}
                </Button>
                <div className="flex items-center gap-2 text-sm">
                  {t('admin_challenges.page_x_of_y', { current: currentPage, total: totalPages })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('admin_challenges.edit_challenge_configuration')}</DialogTitle>
              <DialogDescription>
                {t('admin_challenges.configure_challenge_description')}
              </DialogDescription>
            </DialogHeader>
            {selectedChallenge && (
              <ChallengeAdminForm
                challenge={selectedChallenge}
                onClose={handleClose}
              />
            )}
          </DialogContent>
        </Dialog>

        <ChallengeCreateDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreated={handleChallengeCreated}
        />
      </div>
    </>
  )
}
