import { useState, useEffect, useCallback } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { Challenge, ChallengeCategory, ChallengeDifficulty } from "@/models"
import { DecayFormula } from "@/models/DecayFormula"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import axios from "@/lib/axios"
import { toast } from "sonner"
import { Plus, Trash2, Edit } from "lucide-react"
import Image from "next/image"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FirstBloodManager } from "./FirstBloodManager"

interface ChallengeAdminFormProps {
  readonly challenge: Challenge
  readonly onClose: () => void
}

interface Hint {
  id: number
  title?: string
  content: string
  cost: number
  challengeId: number
  isActive?: boolean
  autoActiveAt?: string | null
}

interface FirstBloodBonus {
  points: number
  badge: string
}

export default function ChallengeAdminForm({ challenge, onClose }: ChallengeAdminFormProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [generalLoading, setGeneralLoading] = useState(false)

  // Helper function to format datetime for backend
  const formatDateTimeForBackend = (dateString: string | null): string | null => {
    if (!dateString) return null
    // Convert datetime-local format to ISO string
    try {
      const date = new Date(dateString)
      return date.toISOString()
    } catch (error) {
      console.error('Error formatting date:', error)
      return null
    }
  }

  // Helper function to format datetime from backend for frontend
  const formatDateTimeForFrontend = (isoString: string | null): string => {
    if (!isoString) return ""
    try {
      const date = new Date(isoString)
      // Format to datetime-local format (YYYY-MM-DDTHH:mm)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch (error) {
      console.error('Error parsing date:', error)
      return ""
    }
  }
  const [decayFormulas, setDecayFormulas] = useState<DecayFormula[]>([])
  const [challengeCategories, setChallengeCategories] = useState<ChallengeCategory[]>([])
  const [challengeDifficulties, setChallengeDifficulties] = useState<ChallengeDifficulty[]>([])
  const [formData, setFormData] = useState({
    points: challenge.points || 0,
    enableFirstBlood: challenge.enableFirstBlood || false,
    decayFormulaId: challenge.decayFormulaId || null as number | null,
    hints: challenge.hints || [] as Hint[],
  })
  
  const initializeFirstBloodBonuses = (): FirstBloodBonus[] => {
    const bonuses = challenge.firstBloodBonuses || []
    const badges = challenge.firstBloodBadges || []
    
    if (bonuses.length === 0) return []
    
    return bonuses.map((points, index) => ({
      points,
      badge: badges[index] || 'trophy'
    }))
  }
  
  const [firstBloodBonuses, setFirstBloodBonuses] = useState<FirstBloodBonus[]>(initializeFirstBloodBonuses())
  const [generalData, setGeneralData] = useState({
    name: challenge.name || "",
    description: challenge.description || "",
    author: challenge.author || "",
    hidden: challenge.hidden || false,
    categoryId: challenge.challengeCategoryId || 1,
    difficultyId: challenge.challengeDifficultyId || 1,
  })
  const [coverPosition, setCoverPosition] = useState({
    x: challenge.coverPositionX ?? 50,
    y: challenge.coverPositionY ?? 50,
  })
  const [coverZoom, setCoverZoom] = useState(challenge.coverZoom ?? 100)
  const [coverLoading, setCoverLoading] = useState(false)
  const [newHint, setNewHint] = useState({ title: "", content: "", cost: 0, isActive: true, autoActiveAt: null as string | null })
  const [editingHints, setEditingHints] = useState<{[key: number]: {title: string, content: string, cost: number, isActive: boolean, autoActiveAt: string | null}}>({})

  const fetchChallengeData = useCallback(async () => {
    try {
      const response = await axios.get(`/api/admin/challenges/${challenge.id}`)
      const challengeData = response.data.challenge
      
      setFormData({
        points: challengeData.points || 0,
        enableFirstBlood: challengeData.enableFirstBlood || false,
        decayFormulaId: challengeData.decayFormulaId || null,
        hints: challengeData.hints || []
      })

      // Update general data with correct category and difficulty IDs
      setGeneralData(prev => ({
        ...prev,
        categoryId: challengeData.categoryId || challengeData.challengeCategoryId || prev.categoryId,
        difficultyId: challengeData.difficultyId || challengeData.challengeDifficultyId || prev.difficultyId,
      }))

      const bonuses = challengeData.firstBloodBonuses || []
      const badges = challengeData.firstBloodBadges || []
      
      if (bonuses.length > 0) {
        setFirstBloodBonuses(bonuses.map((points: number, index: number) => ({
          points,
          badge: badges[index] || 'trophy'
        })))
      } else {
        setFirstBloodBonuses([])
      }
      
    } catch (error) {
      console.error('Failed to fetch challenge data:', error)
    }
  }, [challenge.id])

  const fetchDecayFormulas = async () => {
    try {
      const response = await axios.get("/api/decay-formulas")
      const validFormulas = response.data.filter((formula: DecayFormula) => 
        formula.name && formula.name.trim() !== '' && formula.id > 0
      ).map((formula: any) => ({
        id: formula.id,
        name: formula.name,
        step: formula.step || 10,
        minPoints: formula.minPoints || 10,
        maxDecay: formula.maxDecay || 90
      }))
      setDecayFormulas(validFormulas)
    } catch (error) {
      console.error("Failed to fetch decay formulas:", error)
    }
  }

  const fetchChallengeCategories = async () => {
    try {
      const response = await axios.get("/api/challenge-categories")
      setChallengeCategories(response.data)
    } catch (error) {
      console.error("Failed to fetch challenge categories:", error)
    }
  }

  const fetchChallengeDifficulties = useCallback(async () => {
    try {
      const response = await axios.get(`/api/admin/challenges/${challenge.id}`)
      if (response.data.challengeDifficulties) {
        setChallengeDifficulties(response.data.challengeDifficulties)
      }
    } catch (error) {
      console.error("Failed to fetch challenge difficulties:", error)
    }
  }, [challenge.id])

  useEffect(() => {
    fetchDecayFormulas()
    fetchChallengeCategories()
    fetchChallengeDifficulties()
    fetchChallengeData()
  }, [fetchChallengeDifficulties, fetchChallengeData])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const firstBloodBonusesArray = firstBloodBonuses.map(bonus => bonus.points)
      const firstBloodBadgesArray = firstBloodBonuses.map(bonus => bonus.badge)
      
      await axios.put(`/api/admin/challenges/${challenge.id}`, {
        points: formData.points,
        enableFirstBlood: formData.enableFirstBlood,
        firstBloodBonuses: firstBloodBonusesArray,
        firstBloodBadges: firstBloodBadgesArray,
        decayFormulaId: formData.decayFormulaId,
        hints: formData.hints.map(hint => ({
          id: hint.id,
          title: hint.title || "Hint",
          content: hint.content,
          cost: hint.cost,
          isActive: !!(hint as Hint).isActive,
          autoActiveAt: formatDateTimeForBackend((hint as Hint).autoActiveAt || null)
        }))
      })
      toast.success("Challenge configuration updated successfully")
      onClose()
    } catch (error) {
      toast.error("Failed to update challenge configuration")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneralSubmit = async () => {
    setGeneralLoading(true)
    try {
      await axios.put(`/api/admin/challenges/${challenge.id}/general`, generalData)
      toast.success("Challenge information updated successfully")
      onClose()
    } catch (error) {
      toast.error("Failed to update challenge information")
      console.error(error)
    } finally {
      setGeneralLoading(false)
    }
  }

  const handleAddHint = async () => {
    if (!newHint.title.trim() || !newHint.content.trim() || newHint.cost < 0) {
      toast.error("Please provide valid hint title, content and cost")
      return
    }

    const newHintData = {
      id: 0,
      title: newHint.title,
      content: newHint.content,
      cost: newHint.cost,
      challengeId: challenge.id,
      isActive: newHint.isActive,
      autoActiveAt: newHint.autoActiveAt
    }
    
    const updatedHints = [...formData.hints, newHintData]
    
    setFormData(prev => ({
      ...prev,
      hints: updatedHints
    }))
    
    try {
      const response = await axios.put(`/api/admin/challenges/${challenge.id}`, {
        points: formData.points,
        enableFirstBlood: formData.enableFirstBlood,
        firstBloodBonuses: firstBloodBonuses.map(bonus => bonus.points),
        firstBloodBadges: firstBloodBonuses.map(bonus => bonus.badge),
        decayFormulaId: formData.decayFormulaId,
        hints: updatedHints.map(hint => ({
          id: hint.id,
          title: hint.title || "Hint",
          content: hint.content,
          cost: hint.cost,
          isActive: !!(hint as Hint).isActive,
          autoActiveAt: formatDateTimeForBackend((hint as Hint).autoActiveAt || null)
        }))
      })
      
      const updatedChallenge = response.data
      if (updatedChallenge.hints) {
        setFormData(prev => ({
          ...prev,
          hints: updatedChallenge.hints
        }))
      }
      
      toast.success("Hint added successfully")
    } catch (error) {
      setFormData(prev => ({
        ...prev,
        hints: prev.hints.slice(0, -1)
      }))
      toast.error("Failed to add hint")
      console.error(error)
      return
    }
    
    setNewHint({ title: "", content: "", cost: 0, isActive: true, autoActiveAt: null })
  }

  const handleDeleteHint = async (hintId: number) => {
    try {
      await axios.delete(`/api/admin/challenges/hints/${hintId}`)
      
      setFormData(prev => ({
        ...prev,
        hints: prev.hints.filter(hint => hint.id !== hintId)
      }))
      
      toast.success("Hint deleted successfully")
    } catch (error) {
      toast.error("Failed to delete hint")
      console.error(error)
    }
  }

  const handleSaveHint = async (hintId: number, updatedHint: { title: string; content: string; cost: number; isActive: boolean; autoActiveAt: string | null }) => {
    const originalHints = [...formData.hints]
    const updatedHints = formData.hints.map(h => 
      h.id === hintId 
        ? { ...h, title: updatedHint.title, content: updatedHint.content, cost: updatedHint.cost, isActive: updatedHint.isActive, autoActiveAt: updatedHint.autoActiveAt }
        : h
    )
    
    setFormData(prev => ({
      ...prev,
      hints: updatedHints
    }))
    setEditingHints(prev => {
      const { [hintId]: removed, ...rest } = prev;
      return rest;
    })

    try {
      const response = await axios.put(`/api/admin/challenges/${challenge.id}`, {
        points: formData.points,
        enableFirstBlood: formData.enableFirstBlood,
        firstBloodBonuses: firstBloodBonuses.map(bonus => bonus.points),
        firstBloodBadges: firstBloodBonuses.map(bonus => bonus.badge),
        decayFormulaId: formData.decayFormulaId,
        hints: updatedHints.map(hint => ({
          id: hint.id,
          title: hint.title || "Hint",
          content: hint.content,
          cost: hint.cost,
          isActive: !!(hint as Hint).isActive,
          autoActiveAt: formatDateTimeForBackend((hint as Hint).autoActiveAt || null)
        }))
      })

      const updatedChallenge = response.data
      if (updatedChallenge.hints) {
        setFormData(prev => ({
          ...prev,
          hints: updatedChallenge.hints
        }))
      }

      toast.success("Hint updated successfully")
    } catch (error) {
      setFormData(prev => ({
        ...prev,
        hints: originalHints
      }))
      setEditingHints(prev => ({
        ...prev,
        [hintId]: updatedHint
      }))
      
      toast.error("Failed to update hint")
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">{t('challenge_form.tab_general')}</TabsTrigger>
          <TabsTrigger value="cover">{t('challenge_form.tab_cover')}</TabsTrigger>
          <TabsTrigger value="points">{t('challenge_form.tab_points')}</TabsTrigger>
          <TabsTrigger value="firstblood">{t('challenge_form.tab_firstblood')}</TabsTrigger>
          <TabsTrigger value="hints">{t('challenge_form.tab_hints')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-background scrollbar-thumb-border">
            <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="name">{t('challenge_form.challenge_name')}</Label>
                <Input
                  id="name"
                  value={generalData.name}
                  onChange={(e) => setGeneralData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter challenge name"
                />
              </div>

              <div>
                <Label htmlFor="description">{t('challenge_form.description')}</Label>
                <Textarea
                  id="description"
                  value={generalData.description}
                  onChange={(e) => setGeneralData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter challenge description"
                  rows={6}
                />
              </div>

              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={generalData.author}
                  onChange={(e) => setGeneralData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Enter author name"
                />
              </div>

              <div>
                <Label htmlFor="category">{t('challenge_form.category')}</Label>
                <Select
                  value={generalData.categoryId?.toString() || ""}
                  onValueChange={(value) => setGeneralData(prev => ({ ...prev, categoryId: Number.parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('challenge_form.select_category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {challengeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="difficulty">{t('challenge_form.difficulty')}</Label>
                <Select
                  value={generalData.difficultyId?.toString() || ""}
                  onValueChange={(value) => setGeneralData(prev => ({ ...prev, difficultyId: Number.parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('challenge_form.select_difficulty')} />
                  </SelectTrigger>
                  <SelectContent>
                    {challengeDifficulties.map((difficulty) => (
                      <SelectItem key={difficulty.id} value={difficulty.id.toString()}>
                        {difficulty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="hidden">{t('challenge_form.hidden')}</Label>
                <Switch
                  id="hidden"
                  checked={generalData.hidden}
                  onCheckedChange={(checked: boolean) => setGeneralData(prev => ({ ...prev, hidden: checked }))}
                />
              </div>

            </CardContent>
          </Card>
          </div>
          <div className="pt-4">
            <Button onClick={handleGeneralSubmit} disabled={generalLoading} className="w-full">
              {generalLoading ? t('challenge_form.saving') : t('challenge_form.save_general')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="cover" className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-background scrollbar-thumb-border">
            <Card>
            <CardContent className="pt-6">
              {challenge.coverImg ? (
                <div className="space-y-4">
                  {/* Side-by-side layout: Focal point selector + Live preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Focal point selector */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">{t('challenge_form.drag_focal_point')}</span>
                      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                      <div 
                        className="relative border rounded-lg overflow-hidden bg-muted select-none"
                        style={{ maxHeight: '320px' }}
                      >
                        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                        <div
                          className="relative flex justify-center"
                          onMouseMove={(e) => {
                            if (e.buttons !== 1) return
                            const img = e.currentTarget.querySelector('img')
                            if (!img) return
                            const rect = img.getBoundingClientRect()
                            const x = ((e.clientX - rect.left) / rect.width) * 100
                            const y = ((e.clientY - rect.top) / rect.height) * 100
                            setCoverPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            const img = e.currentTarget.querySelector('img')
                            if (!img) return
                            const rect = img.getBoundingClientRect()
                            const x = ((e.clientX - rect.left) / rect.width) * 100
                            const y = ((e.clientY - rect.top) / rect.height) * 100
                            setCoverPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/challenges/${challenge.id}/cover`}
                            alt="Full cover"
                            className="max-h-[320px] w-auto pointer-events-none select-none"
                            draggable={false}
                          />
                          {/* Focal point marker */}
                          <div 
                            className="absolute w-6 h-6 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                            style={{ 
                              left: `${coverPosition.x}%`, 
                              top: `${coverPosition.y}%`,
                              backgroundColor: 'rgba(59, 130, 246, 0.8)'
                            }}
                          >
                            <div className="absolute inset-1 rounded-full bg-white/60" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Live preview - vertically centered */}
                    <div className="flex flex-col justify-center space-y-1">
                      <span className="text-xs text-muted-foreground">{t('challenge_form.live_preview')}</span>
                      <div className="border rounded-lg overflow-hidden bg-muted">
                        {/* Preview container matching card aspect ratio (411:192 ≈ 2.14:1) */}
                        <div className="w-full aspect-[411/192]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/challenges/${challenge.id}/cover`}
                            alt={t('challenge_form.cover_preview_alt')}
                            className="w-full h-full object-cover"
                            style={{ 
                              objectPosition: `${coverPosition.x}% ${coverPosition.y}%`,
                              transform: `scale(${coverZoom / 100})`,
                              transformOrigin: `${coverPosition.x}% ${coverPosition.y}%`
                            }}
                          />
                        </div>
                      </div>
                      {/* Zoom slider */}
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs text-muted-foreground w-10">{t('challenge_form.zoom')}</span>
                        <input
                          type="range"
                          min="100"
                          max="200"
                          step="5"
                          value={coverZoom}
                          onChange={(e) => setCoverZoom(Number(e.target.value))}
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground w-10 text-right">{coverZoom}%</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={async () => {
                      setCoverLoading(true)
                      try {
                        await axios.put(`/api/admin/challenges/${challenge.id}/general`, {
                          name: generalData.name || challenge.name,
                          description: generalData.description || challenge.description,
                          author: generalData.author || challenge.author,
                          hidden: generalData.hidden,
                          categoryId: generalData.categoryId || challenge.challengeCategoryId,
                          difficultyId: generalData.difficultyId || challenge.challengeDifficultyId,
                          coverPositionX: coverPosition.x,
                          coverPositionY: coverPosition.y,
                          coverZoom: coverZoom,
                        })
                        toast.success(t('challenge_form.cover_saved'))
                      } catch (error) {
                        toast.error(t('challenge_form.cover_save_error'))
                        console.error(error)
                      } finally {
                        setCoverLoading(false)
                      }
                    }} 
                    disabled={coverLoading} 
                    className="w-full"
                  >
                    {coverLoading ? t('challenge_form.saving') : t('challenge_form.save_cover')}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('challenge_form.no_cover')}</p>
                  <p className="text-sm mt-2">{t('challenge_form.upload_cover_hint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="points" className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-background scrollbar-thumb-border">
            <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="points">{t('challenge_form.base_points')}</Label>
                <Input
                  id="points"
                  type="number"
                  min="0"
                  value={formData.points}
                  onChange={(e) => setFormData(prev => ({ ...prev, points: Number.parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <Label htmlFor="decayFormula">{t('challenge_form.decay_formula')}</Label>
                <Select
                  value={formData.decayFormulaId?.toString() || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, decayFormulaId: value === "none" ? null : Number.parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('challenge_form.select_decay')} />
                  </SelectTrigger>
                  <SelectContent>
                    {decayFormulas.map((formula) => (
                      <SelectItem key={formula.id} value={formula.id.toString()}>
                        {formula.type === 'fixed' 
                          ? formula.name 
                          : `${formula.name} - Step: ${formula.step}, Min: ${formula.minPoints}`
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {t('challenge_form.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t('challenge_form.saving') : t('challenge_form.save_config')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="firstblood" className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-background scrollbar-thumb-border">
            <div className="flex items-center justify-between mb-4">
            <Label htmlFor="enableFirstBlood">{t('challenge_form.enable_firstblood')}</Label>
            <Switch
              id="enableFirstBlood"
              checked={formData.enableFirstBlood}
              onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, enableFirstBlood: checked }))}
            />
          </div>

          {formData.enableFirstBlood && (
            <FirstBloodManager 
              bonuses={firstBloodBonuses}
              onChange={setFirstBloodBonuses}
            />
          )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {t('challenge_form.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t('challenge_form.saving') : t('challenge_form.save_config')}
            </Button>
          </div>
        </TabsContent>


        <TabsContent value="hints" className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-track-background scrollbar-thumb-border">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                <div>
                  <Label htmlFor="hintTitle">{t('challenge_form.hint_title')}</Label>
                  <Input
                    id="hintTitle"
                    value={newHint.title}
                    onChange={(e) => setNewHint(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('challenge_form.hint_title_placeholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="hintContent">{t('challenge_form.hint_content')}</Label>
                  <Textarea
                    id="hintContent"
                    value={newHint.content}
                    onChange={(e) => setNewHint(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={t('challenge_form.hint_content_placeholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="hintCost">{t('challenge_form.hint_cost')}</Label>
                  <Input
                    id="hintCost"
                    type="number"
                    min="0"
                    value={newHint.cost}
                    onChange={(e) => setNewHint(prev => ({ ...prev, cost: Number.parseInt(e.target.value) || 0 }))}
                  />
                </div>
                
                {/* New hint auto-activation fields */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="newHintActive"
                    checked={newHint.isActive}
                    onCheckedChange={(checked) => setNewHint(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="newHintActive">{t('challenge_form.hint_active')}</Label>
                </div>
                
                <div>
                  <Label htmlFor="newHintAutoActive">{t('challenge_form.hint_auto_activate')}</Label>
                  <Input
                    id="newHintAutoActive"
                    type="datetime-local"
                    value={newHint.autoActiveAt || ""}
                    onChange={(e) => setNewHint(prev => ({ ...prev, autoActiveAt: e.target.value || null }))}
                    placeholder={t('challenge_form.hint_auto_activate_placeholder')}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('challenge_form.hint_auto_activate_help')}
                  </p>
                </div>
                
                <Button onClick={handleAddHint} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('challenge_form.add_hint')}
                </Button>
              </div>

              {formData.hints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">{t('challenge_form.existing_hints')}</h4>
                  {formData.hints.map((hint) => (
                    <div key={hint.id} className="p-3 border rounded-lg space-y-3 bg-background/50 hover:bg-background/80 transition-colors">
                      {editingHints[hint.id] ? (
                        // Mode édition
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`hint-title-${hint.id}`}>{t('challenge_form.hint_title')}</Label>
                              <Input
                                id={`hint-title-${hint.id}`}
                                value={editingHints[hint.id].title}
                                onChange={(e) => setEditingHints(prev => ({
                                  ...prev,
                                  [hint.id]: { 
                                    ...prev[hint.id], 
                                    title: e.target.value
                                  }
                                }))}
                                placeholder={t('challenge_form.hint_title_placeholder')}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`hint-cost-${hint.id}`}>{t('challenge_form.hint_cost')}</Label>
                              <Input
                                id={`hint-cost-${hint.id}`}
                                type="number"
                                min="0"
                                value={editingHints[hint.id].cost}
                                onChange={(e) => setEditingHints(prev => ({
                                  ...prev,
                                  [hint.id]: { 
                                    ...prev[hint.id],
                                    cost: Number.parseInt(e.target.value) || 0
                                  }
                                }))}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`hint-content-${hint.id}`}>{t('challenge_form.hint_content')}</Label>
                            <Textarea
                              id={`hint-content-${hint.id}`}
                              value={editingHints[hint.id].content}
                              onChange={(e) => setEditingHints(prev => ({
                                ...prev,
                                [hint.id]: { 
                                  ...prev[hint.id],
                                  content: e.target.value
                                }
                              }))}
                              rows={2}
                            />
                          </div>
                          
                          {/* New auto-activation fields */}
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`hint-active-${hint.id}`}
                                checked={editingHints[hint.id].isActive}
                                onCheckedChange={(checked) => setEditingHints(prev => ({
                                  ...prev,
                                  [hint.id]: { 
                                    ...prev[hint.id],
                                    isActive: checked,
                                    // Clear auto-activation when manually disabling
                                    autoActiveAt: checked ? prev[hint.id].autoActiveAt : null
                                  }
                                }))}
                              />
                              <Label htmlFor={`hint-active-${hint.id}`}>{t('challenge_form.hint_active')}</Label>
                            </div>
                            
                            <div>
                              <Label htmlFor={`hint-auto-active-${hint.id}`}>{t('challenge_form.hint_auto_activate')}</Label>
                              <Input
                                id={`hint-auto-active-${hint.id}`}
                                type="datetime-local"
                                value={formatDateTimeForFrontend(editingHints[hint.id].autoActiveAt)}
                                onChange={(e) => setEditingHints(prev => ({
                                  ...prev,
                                  [hint.id]: { 
                                    ...prev[hint.id],
                                    autoActiveAt: e.target.value || null
                                  }
                                }))}
                                placeholder={t('challenge_form.hint_auto_activate_placeholder')}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {t('challenge_form.hint_auto_activate_help')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const updatedHint = editingHints[hint.id];
                                  handleSaveHint(hint.id, updatedHint);
                                }}
                              >
                                {t('challenge_form.save')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingHints(prev => {
                                  const { [hint.id]: removed, ...rest } = prev;
                                  return rest;
                                })}
                              >
                                {t('challenge_form.cancel')}
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHint(hint.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-sm">{hint.title || t('challenge_form.hint')}</h5>
                              <p className="text-sm text-muted-foreground mt-1">{hint.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">{t('challenge_form.cost')}: {hint.cost} {t('challenge_form.points')}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t('challenge_form.status')}: {(hint as Hint).isActive ? (
                                  <span className="text-green-600">{t('challenge_form.active')}</span>
                                ) : (
                                  <span className="text-red-600">{t('challenge_form.inactive')}</span>
                                )}
                              </p>
                              {(hint as Hint).autoActiveAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {t('challenge_form.auto_activation')}: {new Date((hint as Hint).autoActiveAt!).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingHints(prev => ({
                                  ...prev,
                                  [hint.id]: {
                                    title: hint.title || "",
                                    content: hint.content,
                                    cost: hint.cost,
                                    isActive: !!(hint as Hint).isActive,
                                    autoActiveAt: (hint as Hint).autoActiveAt ? formatDateTimeForFrontend((hint as Hint).autoActiveAt!) : null
                                  }
                                }))}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t('challenge_form.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteHint(hint.id)}
                              >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {t('challenge_form.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t('challenge_form.saving') : t('challenge_form.save_config')}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
