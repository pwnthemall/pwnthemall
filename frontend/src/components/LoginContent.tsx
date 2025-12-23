import {
    Card,
    CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"
import Image from "next/image"
import { useTheme } from "next-themes"
import { MagicCard } from "@/components/ui/magic-card"
import { getThemeLogo, getThemeType } from "@/lib/themeConfig"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"

interface LoginContentProps {
    form: {
        username: string
        password: string
    }
    loading?: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onSubmit: (e: React.FormEvent) => void
}

export default function LoginContent({
    form,
    loading = false,
    onChange,
    onSubmit,
}: LoginContentProps) {
    const { t } = useLanguage();
    const { theme } = useTheme();

    const [logoLoaded, setLogoLoaded] = useState(false);

    return (
        <div className="w-full max-w-4xl px-4">
            <Card className="border-0 rounded-[20px] overflow-hidden p-0 shadow-2xl dark:shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
                <MagicCard
                    gradientSize={getThemeType(theme) === "dark" ? 40 : 40}
                    gradientColor={getThemeType(theme) === "dark" ? "#6b6b6b55" : "#c4c4c455"}
                    className="rounded-[20px] p-0"
                >
                    <CardContent className="grid p-0 md:grid-cols-2">
                        <form onSubmit={onSubmit} className="p-6 md:p-8">
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <h1 className="text-2xl font-bold">{t('welcome_back')}</h1>
                                    <p className="text-muted-foreground text-balance">
                                        {t('enter_credentials')}
                                    </p>
                                </div>
                                
                                <div className="grid gap-2">
                                    <Label htmlFor="username">{t('username_or_email')}</Label>
                                    <Input
                                        id="username"
                                        name="username"
                                        value={form.username}
                                        onChange={onChange}
                                        placeholder="you@example.com"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                                
                                <div className="grid gap-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="password">{t('password')}</Label>
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            className="ml-auto text-sm underline-offset-2 hover:underline bg-transparent border-0 cursor-pointer p-0"
                                        >
                                            {t('forgot_password')}
                                        </button>
                                    </div>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="***********"
                                        value={form.password}
                                        onChange={onChange}
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                                
                                <Button 
                                    type="submit" 
                                    className="w-full"
                                    disabled={loading}
                                >
                                    {loading ? t('loading') : t('login')}
                                </Button>
                                
                                <p className="text-center text-sm text-muted-foreground">
                                    {t('dont_have_account')}{" "}
                                    <Link href="/register" className="underline underline-offset-4">
                                        {t('sign_up')}
                                    </Link>
                                </p>
                            </div>
                        </form>
                        
                        <div className="bg-muted/20 flex items-center justify-center p-6 md:p-8 relative">
                            {!logoLoaded && (
                                <Skeleton className="w-[400px] h-[400px] mx-auto" />
                            )}
                            <Image
                                src={getThemeLogo(theme)}
                                alt="logo"
                                width={400}
                                height={400}
                                style={{ width: '400px', height: 'auto' }}
                                className={`mx-auto transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                                onLoad={() => setLogoLoaded(true)}
                                priority
                                unoptimized
                            />
                        </div>
                    </CardContent>
                </MagicCard>
            </Card>
        </div>
    )
}
