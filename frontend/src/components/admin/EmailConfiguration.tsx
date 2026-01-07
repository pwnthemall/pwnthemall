import { useState } from "react";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { toast } from "sonner";
import { Mail, Send, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Config } from "@/models/Config";

interface EmailConfigurationProps {
  configs: Config[];
  onRefresh: () => void;
}

export default function EmailConfiguration({ configs, onRefresh }: EmailConfigurationProps) {
  const { t } = useLanguage();
  const { refreshConfig } = useSiteConfig();
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Get current config values
  const getConfigValue = (key: string) => {
    const config = configs.find(c => c.key === key);
    return config?.value || "";
  };

  const passwordResetEnabled = getConfigValue("PASSWORD_RESET_ENABLED");
  const smtpHost = getConfigValue("SMTP_HOST");
  const smtpPort = getConfigValue("SMTP_PORT");
  const smtpUser = getConfigValue("SMTP_USER");
  const smtpFrom = getConfigValue("SMTP_FROM");

  const [formData, setFormData] = useState({
    smtpHost: smtpHost,
    smtpPort: smtpPort || "587",
    smtpUser: smtpUser,
    smtpPassword: "",
    smtpFrom: smtpFrom,
  });

  const handleTogglePasswordReset = async (enabled: boolean) => {
    setUpdating(true);
    try {
      const value = enabled ? "true" : "false";
      
      // Check if config exists
      const existingConfig = configs.find(c => c.key === "PASSWORD_RESET_ENABLED");
      
      if (existingConfig) {
        await axios.put("/api/configs/PASSWORD_RESET_ENABLED", {
          key: "PASSWORD_RESET_ENABLED",
          value,
          public: true,
          syncWithEnv: true,
        });
      } else {
        await axios.post("/api/configs", {
          key: "PASSWORD_RESET_ENABLED",
          value,
          public: true,
          syncWithEnv: true,
        });
      }
      
      toast.success(t("config_updated_success"));
      refreshConfig();
      onRefresh();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || t("config_update_failed");
      toast.error(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveSmtpConfig = async () => {
    setUpdating(true);
    try {
      const configsToUpdate = [
        { key: "SMTP_HOST", value: formData.smtpHost, public: false, syncWithEnv: true, encrypted: false },
        { key: "SMTP_PORT", value: formData.smtpPort, public: false, syncWithEnv: true, encrypted: false },
        { key: "SMTP_USER", value: formData.smtpUser, public: false, syncWithEnv: true, encrypted: false },
        { key: "SMTP_FROM", value: formData.smtpFrom, public: false, syncWithEnv: true, encrypted: false },
      ];

      // Only update password if it's not empty
      if (formData.smtpPassword) {
        configsToUpdate.push({ 
          key: "SMTP_PASSWORD", 
          value: formData.smtpPassword, 
          public: false, 
          syncWithEnv: true,
          encrypted: true 
        });
      }

      // Create or update each config
      for (const config of configsToUpdate) {
        const existingConfig = configs.find(c => c.key === config.key);
        
        if (existingConfig) {
          await axios.put(`/api/configs/${config.key}`, config);
        } else {
          await axios.post("/api/configs", config);
        }
      }

      toast.success(t("email_config.smtp_config_saved"));
      setFormData(prev => ({ ...prev, smtpPassword: "" }));
      onRefresh();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || t("email_config.smtp_config_save_failed");
      toast.error(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error(t("email_config.email_required"));
      return;
    }

    setSendingTest(true);
    try {
      await axios.post("/api/configs/test-email", { email: testEmail });
      toast.success(t("email_config.test_email_sent"));
      setTestEmail("");
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || t("email_config.test_email_failed");
      toast.error(errorMsg);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>{t("email_config.email_configuration")}</CardTitle>
        </div>
        <CardDescription>{t("email_config.email_configuration_description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Reset Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">{t("email_config.password_reset_enabled")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("email_config.password_reset_enabled_description")}
            </p>
          </div>
          <Switch
            checked={passwordResetEnabled === "true"}
            onCheckedChange={handleTogglePasswordReset}
            disabled={updating}
          />
        </div>

        <Separator />

        {/* SMTP Configuration */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{t("email_config.smtp_settings")}</h3>
            <p className="text-sm text-muted-foreground">{t("email_config.smtp_settings_description")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">{t("email_config.smtp_host")}</Label>
              <Input
                id="smtpHost"
                type="text"
                placeholder="smtp.gmail.com"
                value={formData.smtpHost}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpHost: e.target.value }))}
                disabled={updating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpPort">{t("email_config.smtp_port")}</Label>
              <Select
                value={formData.smtpPort}
                onValueChange={(value) => setFormData(prev => ({ ...prev, smtpPort: value }))}
                disabled={updating}
              >
                <SelectTrigger id="smtpPort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="587">587 (STARTTLS)</SelectItem>
                  <SelectItem value="465">465 (SSL/TLS)</SelectItem>
                  <SelectItem value="25">25 (Plain)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpUser">{t("email_config.smtp_username")}</Label>
              <Input
                id="smtpUser"
                type="text"
                placeholder="your-email@gmail.com"
                value={formData.smtpUser}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpUser: e.target.value }))}
                disabled={updating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpPassword">{t("email_config.smtp_password")}</Label>
              <Input
                id="smtpPassword"
                type="password"
                placeholder={smtpUser ? t("email_config.leave_blank_to_keep") : t("email_config.enter_password")}
                value={formData.smtpPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpPassword: e.target.value }))}
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">{t("email_config.smtp_password_encrypted")}</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="smtpFrom">{t("email_config.smtp_from")}</Label>
              <Input
                id="smtpFrom"
                type="email"
                placeholder="noreply@example.com"
                value={formData.smtpFrom}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpFrom: e.target.value }))}
                disabled={updating}
              />
            </div>
          </div>

          <Button onClick={handleSaveSmtpConfig} disabled={updating}>
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("email_config.saving")}
              </>
            ) : (
              t("email_config.save_smtp_config")
            )}
          </Button>
        </div>

        <Separator />

        {/* Test Email */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{t("email_config.test_email")}</h3>
            <p className="text-sm text-muted-foreground">{t("email_config.test_email_description")}</p>
          </div>

          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={t("email_config.enter_test_email")}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={sendingTest}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendTestEmail();
                }
              }}
            />
            <Button onClick={handleSendTestEmail} disabled={sendingTest || !testEmail.trim()}>
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("email_config.send")}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
