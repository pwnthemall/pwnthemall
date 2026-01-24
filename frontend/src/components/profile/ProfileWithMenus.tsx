import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import axios from "@/lib/axios";
import { AxiosResponse } from "axios";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { useLanguage } from "@/context/LanguageContext";
import { TeamManagementSection } from "@/components/TeamManagementSection";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const TABS = ["Account", "Security", "Appearance", "Team"] as const;
type Tab = typeof TABS[number];

interface GameProfileData extends User {
  points?: number;
  challengesCompleted?: number;
  discordUsername?: string;
  ranking?: number;
  specializations?: string[];
  badges?: string[];
  totalChallenges?: number;
}

export default function ProfileWithMenus() {
  const { t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  // Profile card state
  const [user, setUser] = useState<GameProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("Account");
  
  // Username state
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [confirmUsername, setConfirmUsername] = useState(false);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwValidationError, setPwValidationError] = useState<string | null>(null);
  const [pwTooLongError, setPwTooLongError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState(false);
  
  // Team state
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    setLoading(true);
    axios.get("/api/me").then((res: AxiosResponse<any>) => {
      const gameUser: GameProfileData = {
        ...res.data,
      };
      setUser(gameUser);
      setUsername(res.data.username);
      setNewUsername(res.data.username);
      setCurrentUser({
        id: res.data.id,
        username: res.data.username,
        email: res.data.email,
        role: res.data.role,
        banned: res.data.banned || false,
      });
      
      // Team info
      if (res.data.teamId) {
        setTeamLoading(true);
        setTeam(res.data.team as Team);
        setMembers(res.data.team.members as User[]);
        setTeamError(null);
        setTeamLoading(false);
      } else {
        setTeam(null);
        setMembers([]);
        setTeamLoading(false);
      }
    }).catch(() => {
      setUser(null);
      setUsername("");
      setNewUsername("");
      setCurrentUser(null);
      setTeam(null);
      setMembers([]);
      setTeamLoading(false);
    }).finally(() => setLoading(false));
  }, []);

  // Username handlers
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewUsername(e.target.value);
    if (e.target.value.length > 32) {
      setUsernameError("Username too long (max 32)");
    } else {
      setUsernameError(null);
    }
  };

  const handleUpdate = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res: AxiosResponse<any> = await axios.patch("/api/me", { username: newUsername });
      setUsername(res.data.username);
      setNewUsername(res.data.username);
      toast.success(t("username_updated"));
      window.location.reload();
    } catch (err: any) {
      toast.error(t(err?.response?.data?.error || "Failed to update username"), { className: "bg-red-600 text-white" });
    }
    setConfirmUsername(false);
  };

  const handleDelete = async () => {
    try {
      await axios.delete("/api/me");
      toast.success(t("delete_account_confirm"));
      window.location.href = "/login";
    } catch (err: any) {
      toast.error(t(err?.response?.data?.error || "Failed to delete account"), { className: "bg-red-600 text-white" });
    }
  };

  // Password handlers
  const handleCurrentPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.target.value);
  };

  const handleNewPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
    if (e.target.value.length > 0 && e.target.value.length < 8) {
      setPwValidationError("Password must be at least 8 characters long");
    } else {
      setPwValidationError(null);
    }
    if (e.target.value.length > 72) {
      setPwTooLongError("Password too long (max 72)");
    } else {
      setPwTooLongError(null);
    }
  };

  const handlePasswordChange = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setPwLoading(true);
    try {
      await axios.put("/api/me/password", { current: currentPassword, new: newPassword });
      toast.success(t("password_updated"));
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast.error(t(err?.response?.data?.error || "Failed to update password"), { className: "bg-red-600 text-white" });
    } finally {
      setPwLoading(false);
      setConfirmPassword(false);
    }
  };

  // Theme selector
  const themes = [
    { value: "light", label: "Light", previewLeft: "#ffffff", previewRight: "#f1f5f9" },
    { value: "latte", label: "Latte", previewLeft: "#eff1f5", previewRight: "#ccd1da" },
    { value: "cyberpunk", label: "Cyberpunk", previewLeft: "#1a1a2e", previewRight: "#e91e63" },
    { value: "rose", label: "Rose", previewLeft: "#fffafc", previewRight: "#fee4f1" },
    { value: "emerald", label: "Emerald", previewLeft: "#eefbf5", previewRight: "#d5f5e7" },
    { value: "violet", label: "Violet", previewLeft: "#faf5ff", previewRight: "#f0e1fe" },
    { value: "cyan", label: "Cyan", previewLeft: "#f4ffff", previewRight: "#dfffff" },
    { value: "orange", label: "Orange", previewLeft: "#fffaf5", previewRight: "#ffefe1" },
    { value: "dark", label: "Dark", previewLeft: "#010916", previewRight: "#1c2a3a" },
    { value: "frappe", label: "Frappe", previewLeft: "#2f3445", previewRight: "#60687e" },
    { value: "macchiato", label: "Macchiato", previewLeft: "#222738", previewRight: "#353a4e" },
    { value: "mocha", label: "Mocha", previewLeft: "#1e1f2e", previewRight: "#313343" },
    { value: "slate", label: "Slate", previewLeft: "#0d1728", previewRight: "#475769" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="w-full max-w-6xl mx-auto space-y-6">
          <div className="animate-pulse bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl h-96 border border-primary/20" />
          <div className="animate-pulse bg-muted rounded-lg h-64" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="bg-gradient-to-br from-destructive/20 to-destructive/10 border-destructive/30">
          <CardContent className="p-6 text-center">
            <span className="text-destructive">User not found</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="w-full max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Profile with Full Functionality
          </h1>
          <p className="text-muted-foreground">
            Complete profile management system
          </p>
        </div>

        {/* Profile Card */}
        <div className="w-full max-w-2xl mx-auto">
          <Card className="bg-gradient-to-br from-card via-muted/50 to-card border-2 border-primary/30 shadow-2xl shadow-primary/10 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse"></div>
            <CardContent className="p-8 text-card-foreground relative z-10">
              {/* Header Section */}
              <div className="flex items-start gap-6 mb-8">
                {/* Avatar */}
                <div className="flex-shrink-0 relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent p-1 shadow-lg shadow-primary/30">
                    <Image
                      src="/logo-no-text.png"
                      alt={user?.username ? `${user.username}'s profile` : "Profile Avatar"}
                      width={80}
                      height={80}
                      className="w-full h-full rounded-full object-cover border-2 border-background/20"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full border-3 border-background/30 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {user.username}
                    </h1>
                    <Badge className="bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-primary/30 px-3 py-1">
                      Classement #{user.ranking}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {user.specializations?.map((spec, index) => (
                      <span
                        key={index}
                        className="text-muted-foreground text-sm font-medium bg-secondary/50 px-3 py-1 rounded-full border border-border"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Nombre de Points
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {user.points}
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Nombre de Défis Réalisés
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {user.challengesCompleted !== undefined && user.totalChallenges !== undefined
                      ? `${user.challengesCompleted}/${user.totalChallenges}`
                      : user.challengesCompleted !== undefined
                        ? `${user.challengesCompleted}`
                        : "N/A"}
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Pseudonyme Discord
                  </div>
                  <div className="text-lg font-medium text-foreground truncate">
                    {user.discordUsername || "Non renseigné"}
                  </div>
                </div>
              </div>

              {/* Badges removed */}

              {/* Member Since */}
              <div className="text-center pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Membre depuis : {user.memberSince}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Tabs */}
        <Card className="p-0">
          <div className="flex border-b">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                onClick={() => setActiveTab(tab)}
              >
                {t(tab.toLowerCase())}
              </button>
            ))}
          </div>
          <CardContent className="p-6">
            {activeTab === "Account" && (
              <form className="space-y-4 max-w-md" onSubmit={handleUpdate}>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="username">{t('username')}</label>
                  <Input
                    id="username"
                    name="username"
                    value={newUsername}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    maxLength={32}
                  />
                  {usernameError && <span className="text-red-500 text-xs">{t('username_too_long')}</span>}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={loading || newUsername === username || !newUsername}
                  onClick={() => setConfirmUsername(true)}
                >
                  {t('update_username')}
                </Button>
                
                <AlertDialog open={confirmUsername} onOpenChange={setConfirmUsername}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('change_username')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('change_username_confirm', { username: newUsername })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleUpdate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {t('confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Separator className="my-6" />
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" className="w-full" disabled={loading}>
                      {t('delete_account')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('delete_account')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('delete_account_confirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {t('delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </form>
            )}
            
            {activeTab === "Security" && (
              <form className="space-y-4 max-w-md" onSubmit={handlePasswordChange}>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="current">{t('current_password')}</label>
                  <Input id="current" name="current" type="password" value={currentPassword} onChange={handleCurrentPasswordChange} required autoComplete="current-password" disabled={pwLoading} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="new">{t('new_password')}</label>
                  <Input id="new" name="new" type="password" value={newPassword} onChange={handleNewPasswordChange} required autoComplete="new-password" disabled={pwLoading} maxLength={72} />
                  {pwValidationError && <span className="text-red-500 text-xs">{pwValidationError}</span>}
                  {pwTooLongError && <span className="text-red-500 text-xs">{pwTooLongError}</span>}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={pwLoading || !currentPassword || !newPassword || newPassword.length < 8}
                  onClick={() => setConfirmPassword(true)}
                >
                  {t('change_password')}
                </Button>
                
                <AlertDialog open={confirmPassword} onOpenChange={setConfirmPassword}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('change_password')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('change_password_confirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePasswordChange} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {t('confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </form>
            )}
            
            {activeTab === "Appearance" && (
              <div className="space-y-6 w-full">
                <h2 className="text-xl font-semibold mb-2">Theme</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                  {themes.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors relative overflow-hidden w-full ${theme === t.value ? "border-primary ring-2 ring-primary" : ""}`}
                      style={{ minHeight: 64, background: `linear-gradient(135deg, ${t.previewLeft} 50%, ${t.previewRight} 50%)` }}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={t.value}
                        checked={theme === t.value || (theme === undefined && resolvedTheme === t.value)}
                        onChange={() => setTheme(t.value)}
                        style={{ display: "none" }}
                      />
                      <span className="font-semibold z-10 bg-black/20 backdrop-blur-sm px-2 py-1 rounded text-white drop-shadow-lg border border-white/20">{t.label}</span>
                      {(theme === t.value || (theme === undefined && resolvedTheme === t.value)) && (
                        <span className="ml-auto bg-primary text-primary-foreground text-xs z-10 px-2 py-1 rounded font-medium">Active</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === "Team" && (
              <div className="space-y-4 max-w-md">
                {teamLoading ? (
                  <div>Loading team...</div>
                ) : team && currentUser ? (
                  <TeamManagementSection team={team} members={members} currentUser={currentUser} onTeamChange={() => {}} />
                ) : (
                  <div className="flex flex-col items-start gap-4">
                    <div className="text-red-600">{t('not_in_team')}</div>
                    <Link href="/team" passHref legacyBehavior>
                      <Button type="button" variant="default">
                        {t('join_or_create_team')}
                      </Button>
                    </Link>
                  </div>
                )}
                {teamError && <div className="text-red-600 mt-2">{t(teamError)}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 