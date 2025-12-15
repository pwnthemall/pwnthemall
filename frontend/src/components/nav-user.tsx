"use client"

import Link from "next/link"
import {
  BadgeCheck,
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
  Globe,
  UserRoundIcon,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { useTheme } from "next-themes"
import {
  useSidebar,
} from "@/components/ui/sidebar"
import axios from "@/lib/axios"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from '@/context/LanguageContext'
import { NotificationBell } from './NotificationBell'
import { Button } from "@/components/ui/button" // added to use shadcn button for Login

export function NavUser({
  user,
  onLogout,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  onLogout: () => void
}) {
  const { isMobile, open } = useSidebar()
  const { setTheme } = useTheme()
  const { loggedIn, authChecked } = useAuth()
  const { t, language, setLanguage } = useLanguage();
  const [role, setRole] = useState("")

  useEffect(() => {
    if (!authChecked) return
    if (!loggedIn) {
      setRole("")
      return
    }

    let mounted = true
    axios
      .get("/api/me")
      .then((res) => {
        if (!mounted) return
        setRole(res.data.role || "")
      })
      .catch(() => {
        if (!mounted) return
        setRole("")
      })

    return () => {
      mounted = false
    }
  }, [authChecked, loggedIn])

  return (
    <div className="p-2">
      {/* When NOT logged in show a shadcn "Login" button that links to /login */}
      {!loggedIn ? (
        <Link href="/login" className={cn(open ? "block" : "flex justify-center")}>
          <Button variant="ghost" className={cn("w-full p-2 text-sm flex items-center", open ? "justify-start" : "justify-center")}>
            <Avatar className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center">
              <UserRoundIcon className="h-5 w-5" />
            </Avatar>
            {open && <span className="ml-2">Login</span>}
          </Button>
        </Link>
      ) : (
        <AlertDialog >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center rounded-lg p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200",
                  open ? "gap-2" : "justify-center"
                )}
              >
                <Avatar className="h-8 w-8 rounded-lg flex-shrink-0">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback delayMs={600} className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                {open && (
                  <>
                    <div className="grid flex-1 text-left text-sm leading-tight transition-all duration-200">
                      <span className="truncate font-medium">{user.name}</span>
                      {loggedIn && user.email && (
                        <span className="truncate text-xs">{user.email}</span>
                      )}
                    </div>
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback delayMs={600} className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    {loggedIn && user.email && (
                      <span className="truncate text-xs">{user.email}</span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {loggedIn && (
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                      <BadgeCheck />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setTheme("light")}> <Sun /> Light</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTheme("dark")}> <Moon /> Dark</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {/* Language Switcher */}
                <DropdownMenuItem onSelect={() => setLanguage("en")} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>English</span>
                  {language === "en" && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLanguage("fr")} className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Français</span>
                  {language === "fr" && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="flex items-center gap-2">
                    <NotificationBell />
                    {t('notifications')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {loggedIn && (
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem>
                    <LogOut />
                    {t('logout')}
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('logout_confirm_title')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('logout_confirm_message')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onLogout}>{t('logout')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}