import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useCTFStatus } from "@/hooks/use-ctf-status";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import Head from "next/head";
import ScoreboardContent from "@/components/ScoreboardContent";
import { useLanguage } from '@/context/LanguageContext';

export default function ScoreboardPage() {
  const router = useRouter();
  const { loggedIn, checkAuth, authChecked } = useAuth();
  const { getSiteName } = useSiteConfig();
  const { t } = useLanguage();
  const { ctfStatus, loading: ctfLoading } = useCTFStatus();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authChecked && !loggedIn) {
      router.replace("/login");
    }
  }, [authChecked, loggedIn, router]);

  if (!authChecked) return null;
  if (!loggedIn) return null;

  // Show loading state while CTF status is being checked
  if (ctfLoading) {
    return (
      <>
        <Head>
          <title>{getSiteName()}</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              {t('scoreboard.loading_ctf_status') || 'Loading CTF status...'}
            </p>
          </div>
        </div>
      </>
    );
  }

  // Show message if CTF hasn't started
  if (ctfStatus?.status === 'not_started') {
    return (
      <>
        <Head>
          <title>{`${getSiteName()} - ${t('scoreboard.title') || 'Scoreboard'}`}</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md border-orange-200 dark:border-orange-800">
            <div className="p-6 text-center">
              <Clock className="mx-auto h-12 w-12 text-orange-500 dark:text-orange-400 mb-4" />
              <h2 className="text-xl font-semibold text-orange-800 dark:text-orange-200 mb-2">
                {t('scoreboard.not_available_yet') || 'Scoreboard not available yet'}
              </h2>
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                {t('scoreboard.will_be_available_once_ctf_starts') || 'The scoreboard will be available once the CTF starts.'}
              </p>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Show message if CTF has ended
  if (ctfStatus?.status === 'ended') {
    return (
      <>
        <Head>
          <title>{`${getSiteName()} - ${t('scoreboard.title') || 'Scoreboard'}`}</title>
        </Head>
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md border-blue-200 dark:border-blue-800">
            <div className="p-6 text-center">
              <Clock className="mx-auto h-12 w-12 text-blue-500 dark:text-blue-400 mb-4" />
              <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">
                {t('scoreboard.ctf_has_ended') || 'CTF has ended'}
              </h2>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                {t('scoreboard.final_results') || 'The scoreboard shows the final results from the completed CTF.'}
              </p>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`${getSiteName()} - ${t('scoreboard.title') || 'Scoreboard'}`}</title>
      </Head>
      <ScoreboardContent />
    </>
  );
}
