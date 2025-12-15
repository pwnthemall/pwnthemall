import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Palette } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ThemeMetadata {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  preview: string;
}

interface ThemeManifest {
  generated: string;
  themes: ThemeMetadata[];
}

interface ThemeSelectorFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function ThemeSelectorField({ value, onChange, error }: ThemeSelectorFieldProps) {
  const { t } = useLanguage();
  const [themes, setThemes] = useState<ThemeMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch theme manifest
    fetch('/themes/manifest.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load themes');
        return res.json();
      })
      .then((manifest: ThemeManifest) => {
        setThemes(manifest.themes);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load theme manifest:', err);
        setLoadError('Failed to load available themes');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label htmlFor="theme-select">
          <Palette className="inline-block w-4 h-4 mr-2" />
          {t("site_theme") || "Site Theme"}
        </Label>
        <div className="text-sm text-muted-foreground">Loading themes...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  const currentTheme = themes.find(t => t.id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor="theme-select">
        <Palette className="inline-block w-4 h-4 mr-2" />
        {t("site_theme") || "Site Theme"}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="theme-select" className={error ? "border-red-500" : ""}>
          <SelectValue placeholder={t("select_theme") || "Select a theme"}>
            {currentTheme ? currentTheme.name : value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {themes.map((theme) => (
            <SelectItem key={theme.id} value={theme.id}>
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {theme.name}
                    {theme.id === value && (
                      <Check className="h-3 w-3 text-green-600" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {theme.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentTheme && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>{currentTheme.description}</div>
          <div className="text-xs opacity-70">
            v{currentTheme.version} • by {currentTheme.author}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
