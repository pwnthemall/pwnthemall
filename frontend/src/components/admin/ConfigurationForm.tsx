import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/context/LanguageContext";
import { ConfigFormData } from "@/models/Config";

interface ConfigurationFormProps {
  isEdit?: boolean;
  initialData?: ConfigFormData;
  onSubmit: (data: ConfigFormData) => void;
  apiError?: string | null;
}

export default function ConfigurationForm({
  isEdit = false,
  initialData,
  onSubmit,
  apiError,
}: ConfigurationFormProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<ConfigFormData>({
    key: "",
    value: "",
    public: false,
    syncWithEnv: false,
  });
  const [errors, setErrors] = useState<Partial<ConfigFormData>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<ConfigFormData> = {};

    if (!formData.key.trim()) {
      newErrors.key = t("key_required") || "Key is required";
    }

    // Allow empty values for CTF timing configurations
    if (!formData.value.trim() && formData.key !== "CTF_START_TIME" && formData.key !== "CTF_END_TIME") {
      newErrors.value = t("value_required") || "Value is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof ConfigFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="key">{t("key")}</Label>
        <Input
          id="key"
          type="text"
          value={formData.key}
          onChange={(e) => handleInputChange("key", e.target.value)}
          disabled={isEdit}
          className={errors.key ? "border-red-500" : ""}
          placeholder={t("enter_key") || "Enter configuration key"}
        />
        {errors.key && <p className="text-sm text-red-500">{errors.key}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">{t("value")}</Label>
        {formData.key === "REGISTRATION_ENABLED" ? (
          <Select
            value={formData.value}
            onValueChange={(value) => handleInputChange("value", value)}
          >
            <SelectTrigger className={errors.value ? "border-red-500" : ""}>
              <SelectValue placeholder={t("select_value") || "Select value"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        ) : (formData.key === "CTF_START_TIME" || formData.key === "CTF_END_TIME") ? (
          <div className="space-y-2">
            <DateTimePicker
              date={formData.value ? new Date(formData.value) : undefined}
              onDateChange={(date) => handleInputChange("value", date ? date.toISOString() : "")}
              placeholder={
                formData.key === "CTF_START_TIME"
                  ? t("select_ctf_start_date") || "Select CTF start date and time"
                  : t("select_ctf_end_date") || "Select CTF end date and time"
              }
              className={errors.value ? "border-red-500" : ""}
            />
            <p className="text-sm text-muted-foreground">
              {formData.key === "CTF_START_TIME" 
                ? t("ctf_start_time_description") || "Set when the CTF competition starts. Leave empty for no time restrictions."
                : t("ctf_end_time_description") || "Set when the CTF competition ends. Leave empty for no time restrictions."
              }
            </p>
          </div>
        ) : (
          <Input
            id="value"
            type="text"
            value={formData.value}
            onChange={(e) => handleInputChange("value", e.target.value)}
            className={errors.value ? "border-red-500" : ""}
            placeholder={t("enter_value") || "Enter configuration value"}
          />
        )}
        {errors.value && <p className="text-sm text-red-500">{errors.value}</p>}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="public"
          checked={formData.public}
          onCheckedChange={(checked) => handleInputChange("public", checked as boolean)}
        />
        <Label htmlFor="public">{t("public")}</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="syncWithEnv"
          checked={formData.syncWithEnv}
          onCheckedChange={(checked) => handleInputChange("syncWithEnv", checked as boolean)}
        />
        <Label htmlFor="syncWithEnv">{t("syncWithEnv")}</Label>
      </div>

      {apiError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      <Button type="submit" className="w-full">
        {isEdit ? t("update") : t("create")}
      </Button>
    </form>
  );
} 