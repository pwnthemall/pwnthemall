import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChallengeDifficultyFormData } from "@/models/ChallengeDifficulty"
import { useLanguage } from "@/context/LanguageContext"
import { Badge } from "@/components/ui/badge"

interface ChallengeDifficultiesFormProps {
  initialData?: ChallengeDifficultyFormData
  onSubmit: (data: ChallengeDifficultyFormData) => Promise<void>
  isEdit?: boolean
}

const presetColors = [
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f59e0b" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
  { name: "Gray", value: "#94a3b8" },
];

export default function ChallengeDifficultiesForm({
  initialData,
  onSubmit,
  isEdit = false,
}: ChallengeDifficultiesFormProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialData?.name || "")
  const [color, setColor] = useState(initialData?.color || "#22c55e")
  const [submitting, setSubmitting] = useState(false)

  const getTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ name, color })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">{t('color')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-20 h-10 cursor-pointer"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#22c55e"
            pattern="^#[0-9A-Fa-f]{6}$"
            className="font-mono"
          />
        </div>
        
        <div className="mt-3">
          <Label className="text-sm text-muted-foreground">Quick presets:</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {presetColors.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setColor(preset.value)}
                className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                style={{ 
                  backgroundColor: preset.value,
                  borderColor: color === preset.value ? '#000' : 'transparent'
                }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">{t('preview')}: </span>
          <Badge 
            className="font-normal border-0 ml-2"
            style={{
              backgroundColor: color,
              color: getTextColor(color)
            }}
          >
            {name || "Example"}
          </Badge>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? t('saving') : isEdit ? t('update') : t('create')}
      </Button>
    </form>
  )
}
