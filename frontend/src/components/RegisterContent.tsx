import {
    Card,
    CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"
import React from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { MagicCard } from "@/components/ui/magic-card"

interface RegisterContentProps {
    form: {
        username: string;
        email: string;
        password: string;
    };
    loading: boolean;
    message: { type: "success" | "error"; text: string } | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
}

const RegisterContent: React.FC<RegisterContentProps> = ({
    form,
    loading,
    message,
    onChange,
    onSubmit,
}) => {
    const { t } = useLanguage();
    const { theme } = useTheme();

    const [errors, setErrors] = React.useState<{username?: string, email?: string, password?: string}>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let error = "";
        if (name === "username" && value.length > 32) error = t('username_too_long');
        if (name === "email" && value.length > 254) error = t('email_too_long');
        if (name === "password" && value.length > 72) error = t('password_too_long');
        setErrors({ ...errors, [name]: error });
        onChange(e);
    };

    return (
        <div className="w-full max-w-4xl px-4">
            <Card className="border-0 rounded-[20px] overflow-hidden p-0 shadow-2xl dark:shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
                <MagicCard
                    gradientColor={theme === "dark" ? "#262626" : "#cecece55"}
                    className="rounded-[20px] p-0"
                >
                    <CardContent className="grid p-0 md:grid-cols-2">
                        <form onSubmit={onSubmit} className="p-6 md:p-8">
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <h1 className="text-2xl font-bold">{t('sign_up')}</h1>
                                    <p className="text-muted-foreground text-balance">
                                        {t('create_account')}
                                    </p>
                                </div>
                                
                                <div className="grid gap-2">
                                    <Label htmlFor="username">{t('username')}</Label>
                                    <Input
                                        type="text"
                                        name="username"
                                        placeholder={t('username')}
                                        value={form.username}
                                        onChange={handleChange}
                                        autoComplete="username"
                                        required
                                        maxLength={32}
                                    />
                                    {errors.username && <span className="text-red-500 text-xs">{errors.username}</span>}
                                </div>
                                
                                <div className="grid gap-2">
                                    <Label htmlFor="email">{t('email')}</Label>
                                    <Input
                                        type="email"
                                        name="email"
                                        placeholder={t('email')}
                                        value={form.email}
                                        onChange={handleChange}
                                        autoComplete="email"
                                        required
                                        maxLength={254}
                                    />
                                    {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
                                </div>
                                
                                <div className="grid gap-2">
                                    <Label htmlFor="password">{t('password')}</Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder={t('password_min_8')}
                                        minLength={8}
                                        value={form.password}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        required
                                        maxLength={72}
                                    />
                                    {errors.password && <span className="text-red-500 text-xs">{errors.password}</span>}
                                </div>
                                
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full"
                                >
                                    {loading ? t('loading') : t('register')}
                                </Button>
                                
                                <p className="text-center text-sm text-muted-foreground">
                                    {t('already_have_account')}{" "}
                                    <Link href="/login" className="underline underline-offset-4">
                                        {t('sign_in')}
                                    </Link>
                                </p>
                            </div>
                        </form>
                        
                        <div className="bg-muted/20 flex items-center justify-center p-6 md:p-8">
                            <Image
                                src={theme === 'dark' ? '/logo-v2-text-dark.png' : '/logo-v2-text-light.png'}
                                alt="logo"
                                width="400"
                                height="400"
                                className="mx-auto"
                            />
                        </div>
                    </CardContent>
                </MagicCard>
            </Card>
        </div>
    );
};

export default RegisterContent;
