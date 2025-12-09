import { useState, useEffect } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, MapPin, Flag } from "lucide-react"
import axios from "@/lib/axios"
import { toast } from "sonner"
import GeoPicker from "@/components/pwn/GeoPicker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChallengeCategory, ChallengeDifficulty } from "@/models"

interface ChallengeCreateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCreated: (challengeId: number) => void
}

interface HintInput {
  title: string
  content: string
  cost: number
}

interface CreateChallengeForm {
  name: string
  description: string
  type: "standard" | "geo"
  category: string
  difficulty: string
  points: number
  flags: string[]
  hints: HintInput[]
  hidden: boolean
  author: string
  targetLat: number | null
  targetLng: number | null
  radiusKm: number | null
}

const initialFormState: CreateChallengeForm = {
  name: "",
  description: "",
  type: "standard",
  category: "",
  difficulty: "",
  points: 100,
  flags: [""],
  hints: [],
  hidden: true,
  author: "",
  targetLat: null,
  targetLng: null,
  radiusKm: null,
}

export default function ChallengeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ChallengeCreateDialogProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<ChallengeCategory[]>([])
  const [difficulties, setDifficulties] = useState<ChallengeDifficulty[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [newDifficulty, setNewDifficulty] = useState("")
  const [formData, setFormData] = useState<CreateChallengeForm>(initialFormState)

  useEffect(() => {
    if (open) {
      fetchCategories()
      fetchDifficulties()
      setFormData(initialFormState)
    }
  }, [open])

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/api/challenge-categories")
      setCategories(response.data || [])
    } catch (error) {
      console.error("Failed to fetch categories:", error)
    }
  }

  const fetchDifficulties = async () => {
    try {
      // Get from an existing challenge endpoint that returns difficulties
      const response = await axios.get("/api/admin/challenges")
      if (response.data && response.data.length > 0) {
        // Extract unique difficulties from challenges
        const uniqueDifficulties = Array.from(
          new Map(
            response.data
              .filter((c: { challengeDifficulty?: ChallengeDifficulty }) => c.challengeDifficulty)
              .map((c: { challengeDifficulty: ChallengeDifficulty }) => [
                c.challengeDifficulty.id,
                c.challengeDifficulty,
              ])
          ).values()
        ) as ChallengeDifficulty[]
        setDifficulties(uniqueDifficulties)
      }
    } catch (error) {
      console.error("Failed to fetch difficulties:", error)
    }
  }

  const handleAddFlag = () => {
    setFormData((prev) => ({
      ...prev,
      flags: [...prev.flags, ""],
    }))
  }

  const handleRemoveFlag = (index: number) => {
    if (formData.flags.length > 1) {
      setFormData((prev) => ({
        ...prev,
        flags: prev.flags.filter((_, i) => i !== index),
      }))
    }
  }

  const handleFlagChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      flags: prev.flags.map((flag, i) => (i === index ? value : flag)),
    }))
  }

  const handleAddHint = () => {
    setFormData((prev) => ({
      ...prev,
      hints: [...prev.hints, { title: "", content: "", cost: 0 }],
    }))
  }

  const handleRemoveHint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index),
    }))
  }

  const handleHintChange = (index: number, field: keyof HintInput, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      hints: prev.hints.map((hint, i) => 
        i === index ? { ...hint, [field]: value } : hint
      ),
    }))
  }

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "Challenge name is required"
    if (!formData.description.trim()) return "Description is required"
    
    const category = newCategory.trim() || formData.category
    if (!category) return "Category is required"
    
    const difficulty = newDifficulty.trim() || formData.difficulty
    if (!difficulty) return "Difficulty is required"
    
    if (formData.points < 1) return "Points must be at least 1"
    
    const validFlags = formData.flags.filter((f) => f.trim())
    if (validFlags.length === 0) return "At least one flag is required"
    
    if (formData.type === "geo") {
      if (formData.targetLat === null) return "Target latitude is required for geo challenges"
      if (formData.targetLng === null) return "Target longitude is required for geo challenges"
      if (formData.radiusKm === null || formData.radiusKm <= 0)
        return "Radius (km) must be greater than 0"
      if (formData.targetLat < -90 || formData.targetLat > 90)
        return "Latitude must be between -90 and 90"
      if (formData.targetLng < -180 || formData.targetLng > 180)
        return "Longitude must be between -180 and 180"
    }
    
    return null
  }

  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        category: newCategory.trim() || formData.category,
        difficulty: newDifficulty.trim() || formData.difficulty,
        points: formData.points,
        flags: formData.flags.filter((f) => f.trim()),
        hints: formData.hints
          .filter((h) => h.title.trim() && h.content.trim())
          .map((h) => ({
            title: h.title.trim(),
            content: h.content.trim(),
            cost: h.cost,
            isActive: true,
            autoActiveAt: null,
          })),
        hidden: formData.hidden,
        author: formData.author.trim(),
        ...(formData.type === "geo" && {
          targetLat: formData.targetLat,
          targetLng: formData.targetLng,
          radiusKm: formData.radiusKm,
        }),
      }

      const response = await axios.post("/api/admin/challenges", payload)
      toast.success(`Challenge "${formData.name}" created successfully!`)
      onOpenChange(false)
      onCreated(response.data.id)
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || "Failed to create challenge")
      console.error("Failed to create challenge:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("challenge_create.title") || "Create New Challenge"}
          </DialogTitle>
          <DialogDescription>
            {t("challenge_create.description") ||
              "Create a new standard or geo challenge on the fly. You can add cover images and attachments after creation."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 scrollbar-thin scrollbar-track-background scrollbar-thumb-border">
          {/* Basic Information */}
          <div className="p-6 space-y-4 border rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("challenge_form.challenge_name") || "Name"} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Challenge name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">{t("challenge_form.author") || "Author"}</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("challenge_form.description") || "Description"} *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Challenge description (supports markdown)"
                rows={4}
              />
            </div>

            <div className="space-y-4">
              <Label>{t("challenge_create.type") || "Challenge Type"} *</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.type === "standard" ? "default" : "outline"}
                  onClick={() => setFormData((prev) => ({ ...prev, type: "standard" }))}
                  className="flex-1"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Standard
                </Button>
                <Button
                  type="button"
                  variant={formData.type === "geo" ? "default" : "outline"}
                  onClick={() => setFormData((prev) => ({ ...prev, type: "geo" }))}
                  className="flex-1"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  GeoInt
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("challenge_form.category") || "Category"} *</Label>
                {!newCategory ? (
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      if (value === "__new__") {
                        setFormData((prev) => ({ ...prev, category: "" }))
                        setNewCategory(" ") // Trigger input display
                      } else {
                        setFormData((prev) => ({ ...prev, category: value }))
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("challenge_form.select_category") || "Select category"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Create new category</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="New category name"
                    value={newCategory.trim()}
                    onChange={(e) => setNewCategory(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("challenge_form.difficulty") || "Difficulty"} *</Label>
                {!newDifficulty ? (
                  <Select
                    value={formData.difficulty}
                    onValueChange={(value) => {
                      if (value === "__new__") {
                        setFormData((prev) => ({ ...prev, difficulty: "" }))
                        setNewDifficulty(" ") // Trigger input display
                      } else {
                        setFormData((prev) => ({ ...prev, difficulty: value }))
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("challenge_form.select_difficulty") || "Select difficulty"} />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map((diff) => (
                        <SelectItem key={diff.id} value={diff.name}>
                          {diff.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Create new difficulty</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="New difficulty name (e.g., Easy, Medium, Hard)"
                    value={newDifficulty.trim()}
                    onChange={(e) => setNewDifficulty(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>

          {/* Points, Flags, and Hints */}
          <div className="p-6 space-y-4 border rounded-lg">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                {t("challenge_create.flags") || "Flags"} *
              </Label>
              <div className="space-y-2">
                {formData.flags.map((flag, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={flag}
                      onChange={(e) => handleFlagChange(index, e.target.value)}
                      placeholder={`Flag ${index + 1} (e.g., flag{s3cr3t_v4lu3})`}
                      className="font-mono"
                    />
                    {formData.flags.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFlag(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {index === formData.flags.length - 1 && (
                      <Button type="button" variant="outline" size="icon" onClick={handleAddFlag}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="points">{t("challenge_form.base_points") || "Points"} *</Label>
              <Input
                id="points"
                type="number"
                min={1}
                value={formData.points}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, points: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("challenge_create.hints") || "Hints"} {t("challenge_create.optional") || "(optional)"}</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddHint}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("challenge_create.add_hint") || "Add hint"}
                </Button>
              </div>
              {formData.hints.length > 0 && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  {formData.hints.map((hint, index) => (
                    <div key={index} className="space-y-2 p-3 border rounded-lg bg-background">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Hint {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveHint(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={hint.title}
                        onChange={(e) => handleHintChange(index, "title", e.target.value)}
                        placeholder={t("challenge_create.hint_title_placeholder") || "Hint title"}
                      />
                      <Textarea
                        value={hint.content}
                        onChange={(e) => handleHintChange(index, "content", e.target.value)}
                        placeholder={t("challenge_create.hint_content_placeholder") || "Hint content"}
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`hint-cost-${index}`} className="text-sm">
                          {t("challenge_create.hint_cost") || "Cost (points)"}
                        </Label>
                        <Input
                          id={`hint-cost-${index}`}
                          type="number"
                          min={0}
                          value={hint.cost}
                          onChange={(e) => handleHintChange(index, "cost", parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {formData.type === "geo" && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                GeoInt Configuration
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Map Location & Radius *</Label>
                  <p className="text-xs text-muted-foreground">
                    Click on the map to place the target pin. Use scroll/zoom to adjust the circle radius.
                  </p>
                  <div className="border rounded-lg overflow-hidden" style={{ height: 400 }}>
                    <GeoPicker
                      value={
                        formData.targetLat !== null && formData.targetLng !== null
                          ? { lat: formData.targetLat, lng: formData.targetLng }
                          : null
                      }
                      onChange={(coords: { lat: number; lng: number }) => {
                        setFormData((prev) => ({
                          ...prev,
                          targetLat: coords.lat,
                          targetLng: coords.lng,
                        }))
                      }}
                      radiusKm={formData.radiusKm}
                      height="100%"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="radiusKm">Radius (km) *</Label>
                    <span className="text-sm text-muted-foreground">{formData.radiusKm?.toFixed(2) ?? "0.50"} km</span>
                  </div>
                  <input
                    id="radiusKm"
                    type="range"
                    min="0.01"
                    max="10"
                    step="0.01"
                    value={formData.radiusKm ?? 0.5}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        radiusKm: Number.parseFloat(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Players must submit coordinates within this radius to solve the challenge.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Hidden toggle */}
          <div className="p-6 space-y-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hidden">{t("challenge_form.hidden") || "Hidden"}</Label>
                <p className="text-sm text-muted-foreground">
                  Hidden challenges are not visible to players
                </p>
              </div>
              <Switch
                id="hidden"
                checked={formData.hidden}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, hidden: checked }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("challenge_form.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>Creating...</>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Challenge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
