import { useState, useEffect } from "react";
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
import { ArrowLeft, Key, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { getThemeType } from "@/lib/themeConfig";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const { getSiteName, siteConfig, loading: configLoading } = useSiteConfig();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token || typeof token !== 'string') {
      setValidating(false);
      setTokenError(t('password_reset.token_invalid'));
      return;
    }

    const validateToken = async () => {
      try {
        await axios.get(`/api/validate-reset-token/${token}`);
        setTokenValid(true);
      } catch (error: any) {
        const errorMsg = error?.response?.data?.error || t('password_reset.token_invalid');
        setTokenError(errorMsg);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, t]);

  // Check if password reset is disabled
  if (!configLoading && siteConfig.PASSWORD_RESET_ENABLED === 'false') {
    return (
      <>
        <Head>
          <title>{t('password_reset.title')} - {getSiteName()}</title>
        </Head>
        <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative bg-muted/20">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('password_reset.feature_disabled')}</h2>
              <Button onClick={() => router.push('/login')} className="w-full mt-4">
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

    // Validation
    if (password.length < 8) {
      toast.error(t('password_too_short'));
      return;
    }

    if (password.length > 72) {
      toast.error(t('password_too_long'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('password_reset.passwords_dont_match'));
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/reset-password', {
        token: token as string,
        password
      });
      setSuccess(true);
      toast.success(t('password_reset.reset_success'));
    } catch (error: any) {
      const errorKey = error?.response?.data?.error || 'Failed to reset password';
      toast.error(t(errorKey) || errorKey, { className: "bg-red-600 text-white" });
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validating) {
    return (
      <>
        <Head>
          <title>{t('password_reset.title')} - {getSiteName()}</title>
        </Head>
        <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative bg-muted/20">
          <div className="w-full max-w-md px-4">
            <Card className="border-0 rounded-[20px] overflow-hidden shadow-2xl">
              <CardContent className="p-8 space-y-4">
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6 mx-auto" />
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // Invalid token
  if (!tokenValid) {
    return (
      <>
        <Head>
          <title>{t('password_reset.title')} - {getSiteName()}</title>
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
                    <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    
                    <div>
                      <h1 className="text-2xl font-bold mb-2">{t('password_reset.token_invalid')}</h1>
                      <p className="text-muted-foreground text-balance">
                        {tokenError}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        onClick={() => router.push('/forgot-password')} 
                        className="w-full"
                      >
                        {t('password_reset.token_expired_request_new')}
                      </Button>
                      <Button 
                        onClick={() => router.push('/login')} 
                        variant="outline"
                        className="w-full"
                      >
                        {t('password_reset.back_to_login')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </MagicCard>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // Success state
  if (success) {
    return (
      <>
        <Head>
          <title>{t('password_reset.title')} - {getSiteName()}</title>
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
                      <h1 className="text-2xl font-bold mb-2">{t('password_reset.reset_success')}</h1>
                      <p className="text-muted-foreground text-balance">
                        {t('password_reset.reset_success_message')}
                      </p>
                    </div>

                    <Button 
                      onClick={() => router.push('/login')} 
                      className="w-full"
                    >
                      {t('password_reset.go_to_login')}
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

  // Reset password form
  return (
    <>
      <Head>
        <title>{t('password_reset.title')} - {getSiteName()}</title>
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
                      <Key className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">{t('password_reset.title')}</h1>
                    <p className="text-muted-foreground text-balance">
                      {t('password_reset.reset_password_subtitle')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('password_reset.new_password')}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t('password_reset.password_min_8')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        autoFocus
                        required
                        disabled={loading}
                        minLength={8}
                        maxLength={72}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('password_reset.confirm_password')}</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t('password_reset.confirm_password')}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={loading}
                        minLength={8}
                        maxLength={72}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {t('password_reset.passwords_dont_match')}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loading || !password || !confirmPassword || password !== confirmPassword}
                  >
                    {loading ? t('loading') : t('password_reset.reset_password')}
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
