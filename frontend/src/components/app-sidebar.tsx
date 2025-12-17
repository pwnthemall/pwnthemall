"use client";

import * as React from "react";
import { Home, Swords, LogIn, UserPlus, User, List, ShieldUser, Bell, Flag } from "lucide-react";
import { useRouter } from "next/router";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

import axios from "@/lib/axios";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useCTFStatus } from "@/hooks/use-ctf-status";
import type { NavItem } from "@/models/NavItem";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { getThemeLogo } from "@/lib/themeConfig";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { loggedIn, logout, authChecked } = useAuth();
  const { t } = useLanguage();
  const { getSiteName, siteConfig } = useSiteConfig();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { ctfStatus, loading: ctfLoading } = useCTFStatus();
  const { theme } = useTheme();

  const [userData, setUserData] = React.useState({
    name: "",
    email: "",
    avatar: "/logo-no-text.png",
    role: "",
  });

  // Refactored user data fetcher
  const fetchUserData = React.useCallback(() => {
    if (loggedIn) {
      axios
        .get("/api/me")
        .then((res) => {
          const { username, email, role } = res.data;
          setUserData({
            name: username,
            email,
            avatar: "/logo-no-text.png",
            role,
          });
        })
        .catch(() => {
          setUserData({ name: "Guest", email: "", avatar: "/logo-no-text.png", role: "" });
        });
    } else {
      setUserData({ name: "Guest", email: "", avatar: "/logo-no-text.png", role: "" });
    }
  }, [loggedIn]);

  React.useEffect(() => {
    if (!authChecked) return;
    fetchUserData();
  }, [loggedIn, authChecked, fetchUserData]);

  // Listen for auth:refresh events to update sidebar user info
  React.useEffect(() => {
    const handleAuthRefresh = () => {
      fetchUserData();
    };
    window.addEventListener('auth:refresh', handleAuthRefresh);
    return () => {
      window.removeEventListener('auth:refresh', handleAuthRefresh);
    };
  }, [fetchUserData]);

  const navItems = React.useMemo(() => {
    if (!authChecked) return [];
    const items: NavItem[] = [];
    
    // Only show pwn section if CTF has started (active, ended, no timing, or still loading CTF status)
    const shouldShowPwn = ctfLoading || ctfStatus.status !== 'not_started';
    items.push({
      title: t('Home'),
      url: "/",
      icon:  Home,
      isActive: router.pathname.startsWith("/"),
    });
    if (loggedIn && shouldShowPwn) {
      items.push({
        title: t('pwn'),
        url: "/pwn",
        icon: Swords,
        isActive: router.pathname.startsWith("/pwn"),
      });
    }
    
    if (loggedIn) {
      // Only show scoreboard if CTF has started (active, ended, or no timing)
      const shouldShowScoreboard = ctfLoading || ctfStatus.status !== 'not_started';
      
      if (shouldShowScoreboard) {
      items.push({
        title: t('scoreboard'),
        url: "/scoreboard",
        icon: List,
        isActive: router.pathname === "/scoreboard",
      });
      }
      if (userData.role === "admin") {
        items.push({
          title: t('administration'),
          url: "/admin",
          icon: ShieldUser,
          items: [
            { title: t('dashboard'), url: "/admin/dashboard" },
            { title: t('users'), url: "/admin/users" },
            { title: t('instances'), url: "/admin/instances" },
            { title: t('admin.submissions'), url: "/admin/submissions" },
            { title: 'Categories & Difficulties', url: "/admin/challenge-categories" },
            { title: 'Challenges', url: "/admin/challenges" },
            { title: t('challenge_order_management'), url: "/admin/challenge-order" },
            { title: t('configuration'), url: "/admin/configuration" },
            { title: 'Notifications', url: "/admin/notifications" },
          ],
          isActive:
            router.pathname === "/admin/dashboard" ||
            router.pathname === "/admin/users" ||
            router.pathname === "/admin/instances" ||
            router.pathname === "/admin/submissions" ||
            router.pathname === "/admin/challenge-categories" ||
            router.pathname === "/admin/challenges" ||
            router.pathname === "/admin/challenge-order" ||
            router.pathname === "/admin/configuration" ||
            router.pathname === "/admin/notifications",
        });
      }
    } else {
      // Not logged in
    }
    return items;
  }, [authChecked, loggedIn, router.pathname, userData.role, t, siteConfig.REGISTRATION_ENABLED, ctfLoading, ctfStatus.status]);

  return (
    <Sidebar
      collapsible="icon"
      className={cn(!authChecked && "invisible pointer-events-none")}
      {...props}
    >
      <div className="flex flex-col h-full">
        <SidebarHeader>
          <Link href="/">
            <Image
              src={getThemeLogo(theme)}
              alt={getSiteName()}
              width={isMobile ? 150 : 150}
              height={isMobile ? 150 : 150}
              className="mx-auto pt-2"
            ></Image>
          </Link>
        </SidebarHeader>
        {authChecked && (
          <>
            <SidebarContent className="flex flex-col flex-1 min-h-0">
              <NavMain items={navItems} />
            </SidebarContent>
            <SidebarFooter className="mt-auto">
              <NavUser user={userData} onLogout={logout} />
            </SidebarFooter>
          </>
        )}
      </div>
    </Sidebar>
  );
}
