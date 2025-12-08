import React, { useState } from "react"
import { Challenge } from "@/models/Challenge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/context/LanguageContext"
import { toast } from "sonner"

interface ChallengeFormProps {
  onSubmit: (data: ChallengeFormData) => void
  initialData?: Partial<Challenge>
  isEdit?: boolean
  apiError?: string
}

export type ChallengeFormData = {
  name: string
  description: string
  points?: number
  categoryId: number
  typeId: number
  difficultyId: number
}

export default function ChallengeForm({
  onSubmit,
  initialData,
  isEdit = false,
  apiError,
}: ChallengeFormProps) {
  const { t } = useLanguage()
  const [form, setForm] = useState<ChallengeFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    points: 100,
    categoryId: initialData?.challengeCategoryId || 1,
    typeId: initialData?.challengeTypeId || 1,
    difficultyId: initialData?.challengeDifficultyId || 1,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm({
      ...form,
      [name]: name === "points" ? Number.parseInt(value, 10) || 0 : value
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {apiError && (
        <p className="text-sm font-medium text-destructive">
          {apiError}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input 
          id="name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder={t("name")}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Input 
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder={t("description")}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="points">{t("points")}</Label>
        <Input 
          id="points"
          name="points"
          type="number"
          value={form.points}
          onChange={handleChange}
          placeholder={t("points")}
          required
        />
      </div>

      <Button type="submit">
        {isEdit ? t("update") : t("create")}
      </Button>
    </form>
  )
}
