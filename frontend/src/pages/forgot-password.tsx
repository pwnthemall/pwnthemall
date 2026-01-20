import { useState } from "react";
import { useRouter } from "next/router";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import axios from "@/lib/axios";
import { toast } from "sonner";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { getThemeType } from "@/lib/themeConfig";
import { useTheme } from "next-themes";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { getSiteName, siteConfig, loading: configLoading } = useSiteConfig();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check if password reset is disabled
  if (!configLoading && siteConfig.PASSWORD_RESET !== 'true') {
    return (
      <>
        <Head>
          <title>{t('password_reset.forgot_password_title')} - {getSiteName()}</title>
        </Head>
        <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative bg-muted/20">
          <Button
            variant="ghost"
            className="absolute top-4 left-4 h-8 w-8 p-0"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('password_reset.feature_disabled')}</h2>
              <p className="text-muted-foreground mb-4">{t('password_reset.feature_disabled')}</p>
              <Button onClick={() => router.push('/login')} className="w-full">
                {t('password_reset.back_to_login')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t('please_fill_fields'));
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/forgot-password', { email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (error: any) {
      // Always show success message for security (don't leak user existence)
      // But catch other errors like rate limiting
      const errorKey = error?.response?.data?.error;
      if (errorKey && (errorKey.includes('rate') || errorKey.includes('disabled'))) {
        toast.error(t(errorKey) || errorKey);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Head>
          <title>{t('password_reset.forgot_password_title')} - {getSiteName()}</title>
        </Head>
        <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative bg-muted/20">
          <div className="w-full max-w-md px-4">
            <Card className="border-0 rounded-[20px] overflow-hidden shadow-2xl dark:shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
              <MagicCard
                gradientSize={getThemeType(theme) === "dark" ? 40 : 40}
                gradientColor={getThemeType(theme) === "dark" ? "#6b6b6b55" : "#c4c4c455"}
                className="rounded-[20px] p-0"
              >
                <CardContent className="p-8">
                  <div className="text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    
                    <div>
                      <h1 className="text-2xl font-bold mb-2">{t('check_your_email')}</h1>
                      <p className="text-muted-foreground text-balance">
                        {t('password_reset.email_sent')}
                      </p>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                      <p className="text-sm font-medium">{t('password_reset.didnt_receive_email')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('password_reset.check_spam')}
                      </p>
                    </div>

                    <Button 
                      onClick={() => router.push('/login')} 
                      className="w-full"
                    >
                      {t('password_reset.back_to_login')}
                    </Button>
                  </div>
                </CardContent>
              </MagicCard>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t('password_reset.forgot_password_title')} - {getSiteName()}</title>
      </Head>
      <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative bg-muted/20">
        <Button
          variant="ghost"
          className="absolute top-4 left-4 h-8 w-8 p-0"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="w-full max-w-md px-4">
          <Card className="border-0 rounded-[20px] overflow-hidden shadow-2xl dark:shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
            <MagicCard
              gradientSize={getThemeType(theme) === "dark" ? 40 : 40}
              gradientColor={getThemeType(theme) === "dark" ? "#6b6b6b55" : "#c4c4c455"}
              className="rounded-[20px] p-0"
            >
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">{t('password_reset.forgot_password_title')}</h1>
                    <p className="text-muted-foreground text-balance">
                      {t('password_reset.forgot_password_subtitle')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('password_reset.email_placeholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      required
                      disabled={loading}
                      maxLength={254}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loading || !email.trim()}
                  >
                    {loading ? t('loading') : t('password_reset.send_reset_link')}
                  </Button>

                  <div className="text-center">
                    <Link 
                      href="/login" 
                      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      {t('password_reset.back_to_login')}
                    </Link>
                  </div>
                </form>
              </CardContent>
            </MagicCard>
          </Card>
        </div>
      </div>
    </>
  );
}
