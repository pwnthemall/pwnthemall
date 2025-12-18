import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import LoginContent from "@/components/LoginContent";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import axios from "@/lib/axios";
import Head from "next/head";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LoginPage = () => {
  const router = useRouter();
  const { login, loggedIn, authChecked } = useAuth();
  const { t, language } = useLanguage();
  const { getSiteName } = useSiteConfig();

  const [form, setForm] = useState({ username: "", password: "" });

  // Redirect to home if already logged in
  useEffect(() => {
    if (authChecked && loggedIn) {
      router.replace('/');
    }
  }, [authChecked, loggedIn, router]);

  useEffect(() => {
    if (router.query.success === "register") {
      const { success, ...rest } = router.query;
      const query = new URLSearchParams(rest as Record<string, string>).toString();
      router.replace(`/login${query ? `?${query}` : ""}`, undefined, { shallow: true });
    }
    
    // Show ban message if user was banned
    if (router.query.banned === "true") {
      toast.error(t("banned_from_competition"), {
        duration: Infinity,
        className: "bg-red-600 text-white",
      });
    }
  }, [router.query, t, router, language]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Send "username" in payload (can be username or email)
      const res = await axios.post("/api/login", form);
      login();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:refresh"));
      }
      localStorage.setItem("showToast", JSON.stringify({ type: "success", key: "login_success", lang: language }));
      router.push("/pwn");
    } catch (error: any) {
      const errorKey = error?.response?.data?.error || "Error during login";
      // Show error toast immediately, don't store in localStorage since user stays on login page
      toast.error(t(errorKey), { className: "bg-red-600 text-white" });
    }
  };

  // Don't render login form if already logged in
  if (authChecked && loggedIn) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen w-screen bg-muted flex items-center justify-center overflow-hidden relative">
        <Button
          variant="ghost"
          className="absolute top-4 left-4 h-8 w-8 p-0"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <LoginContent form={form} onChange={onChange} onSubmit={handleLogin} />
      </div>
    </>
  );
};

export default LoginPage;
