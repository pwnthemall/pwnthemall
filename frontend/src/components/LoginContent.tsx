import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"

interface LoginContentProps {
    form: {
        username: string
        password: string
    }
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onSubmit: (e: React.FormEvent) => void
}

export default function LoginContent({
    form,
    onChange,
    onSubmit,
}: LoginContentProps) {
    const { t } = useLanguage();

    return (
        <div className="w-full max-w-sm px-4"> {/* removed min-h-screen; parent controls fullscreen/scroll */}
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">{t('welcome_back')}</CardTitle>
                    <CardDescription>{t('enter_credentials')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="username">{t('username_or_email')}</Label>
                            <Input
                                id="username"
                                name="username"
                                value={form.username}
                                onChange={onChange}
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center">
                                <Label htmlFor="password" >{t('password')}</Label>
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    className="ml-auto text-sm underline-offset-4 hover:underline bg-transparent border-0 cursor-pointer p-0"
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
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            {t('login')}
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                            {t('dont_have_account')}{" "}
                            <Link href="/register" className="underline underline-offset-4">
                                {t('sign_up')}
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
