import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import { useRouter } from "next/router";
import { useSiteConfig } from "@/context/SiteConfigContext";
import RegisterContent from "@/components/auth/RegisterContent";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import Head from "next/head";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const RegisterPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const { getSiteName, siteConfig, loading: configLoading } = useSiteConfig();
  const { loggedIn, authChecked } = useAuth();

  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  // Redirect to home if already logged in
  useEffect(() => {
    if (authChecked && loggedIn) {
      router.replace('/');
    }
  }, [authChecked, loggedIn, router]);

  // Check if registration is enabled
  useEffect(() => {
    // Only check if config is loaded (not loading)
    if (!configLoading) {
      setRegistrationEnabled(siteConfig.REGISTRATION_ENABLED !== "false");
    }
  }, [siteConfig.REGISTRATION_ENABLED, configLoading]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`/api/register`, form);
      toast.success(t("registration_successful"), {
        icon: <CheckCircle className="w-4 h-4" />,
        className: "success-toast",
      });
      router.push({
        pathname: "/login",
        query: { success: "register" },
      });
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || "An error has occurred";
      toast.error(t(errMsg) || errMsg, { className: "bg-red-600 text-white" });
    } finally {
      setLoading(false);
    }
  };

  // Don't render if already logged in
  if (authChecked && loggedIn) {
    return null;
  }

  // Show loading state while config is being loaded
  if (configLoading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center">
        <p>{t('loading')}</p>
      </div>
    );
  }

  // If registration is disabled, show disabled message
  if (!registrationEnabled) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative">
        <Button
          variant="ghost"
          className="absolute top-4 left-4 h-8 w-8 p-0"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-lg font-semibold">{t('registration_disabled')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center overflow-hidden relative">
      <Button
        variant="ghost"
        className="absolute top-4 left-4 h-8 w-8 p-0"
        onClick={() => router.back()}
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <RegisterContent
        form={form}
        loading={loading}
        message={null}
        onChange={onChange}
        onSubmit={handleRegister}
      />
    </div>
  );
};

export default RegisterPage;
