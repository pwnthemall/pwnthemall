import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import Head from "next/head";
import { Loader } from "lucide-react";
import NotificationsContent from "@/components/notifications/NotificationsContent";

export default function NotificationsPage() {
  const { loading, loggedIn } = useProtectedRoute();
  const { getSiteName } = useSiteConfig();
  const { t } = useLanguage();

  if (loading) {
    return <Loader />;
  }

  if (!loggedIn) return null;

  return (
    <>
      <Head>
        <title>{t('notifications')} - {getSiteName()}</title>
      </Head>
      <div className="space-y-6 px-4 py-10 bg-muted min-h-screen">
        <NotificationsContent />
      </div>
    </>
  );
} 