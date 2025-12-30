"use client";

import * as React from "react";
import { Home, Swords, LogIn, UserPlus, User, List, ShieldUser, Bell, Flag, MessageSquare } from "lucide-react";
import { useRouter } from "next/router";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarBurger,
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
  const { isMobile, open } = useSidebar();
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
      title: t('sidebar.home'),
      url: "/pages/index",
      icon:  Home,
      isActive: router.pathname.startsWith("/pages/index"),
    });
    if (loggedIn && shouldShowPwn) {
      items.push({
        title: t('dashboard'),
        url: "/",
        icon: Swords,
        isActive: router.pathname.startsWith("/"),
      });
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
      
      // Only show tickets if enabled (and not admin - admins use admin/tickets)
      if (siteConfig.TICKETS_ENABLED !== 'false' && userData.role !== "admin") {
        items.push({
          title: t('tickets'),
          url: "/tickets",
          icon: MessageSquare,
          isActive: router.pathname.startsWith("/tickets"),
        });
      }
      
      if (userData.role === "admin") {
        // Build admin sub-items dynamically
        const adminSubItems = [
          { title: t('dashboard'), url: "/admin/dashboard" },
          { title: t('users'), url: "/admin/users" },
          { title: t('instances'), url: "/admin/instances" },
          { title: t('admin.submissions'), url: "/admin/submissions" },
          { title: t('admin.pages_management'), url: "/admin/pages"}
        ];
        
        // Add tickets management if enabled
        if (siteConfig.TICKETS_ENABLED !== 'false') {
          adminSubItems.push({ title: t('admin.tickets'), url: "/admin/tickets" });
        }
        
        adminSubItems.push(
          { title: 'Categories & Difficulties', url: "/admin/challenge-categories" },
          { title: 'Challenges', url: "/admin/challenges" },
          { title: t('challenge_order_management'), url: "/admin/challenge-order" },
          { title: t('configuration'), url: "/admin/configuration" },
          { title: 'Notifications', url: "/admin/notifications" }
        );
        
        items.push({
          title: t('administration'),
          url: "/admin",
          icon: ShieldUser,
          items: adminSubItems,
          isActive:
            router.pathname === "/admin/dashboard" ||
            router.pathname === "/admin/users" ||
            router.pathname === "/admin/instances" ||
            router.pathname === "/admin/submissions" ||
            router.pathname === "/admin/tickets" ||
            router.pathname === "/admin/challenge-categories" ||
            router.pathname === "/admin/challenges" ||
            router.pathname === "/admin/challenge-order" ||
            router.pathname === "/admin/configuration" ||
            router.pathname === "/admin/notifications" ||
            router.pathname === "/admin/pages"
        });
      }
    } else {
      // Not logged in
    }
    return items;
  }, [authChecked, loggedIn, router.pathname, userData.role, t, siteConfig.TICKETS_ENABLED, ctfLoading, ctfStatus.status]);

  return (
    <Sidebar
      collapsible="icon"
      className={cn(!authChecked && "invisible pointer-events-none")}
      {...props}
    >
      <div className="flex flex-col h-full">
        <SidebarHeader>
          <div className={cn(
            "flex items-center transition-all duration-300",
            open ? "gap-2 justify-start" : "justify-center flex-col gap-2"
          )}>
            {open && (
              <Link href="/pages/index">
                <Image
                  src={getThemeLogo(theme)}
                  alt={getSiteName()}
                  width={150}
                  height={150}
                  style={{ width: '150px', height: 'auto' }}
                  className="pt-2"
                />
              </Link>
            )}
            <SidebarBurger />
          </div>
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
