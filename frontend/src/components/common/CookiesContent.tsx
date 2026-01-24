import Head from "next/head";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cookie, Info, Settings } from "lucide-react";
import Link from "next/link"

export default function CookiesContent() {
  const { t } = useLanguage();
  
  return (
    <>
      <Head>
        <title>{t('cookies.page_title')}</title>
      </Head>
      <div className="bg-muted min-h-screen py-4 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Cookie className="w-8 h-8 dark:text-cyan-400" />
            <h1 className="text-4xl font-bold dark:text-cyan-400">
              {t('cookies.title')}
            </h1>
          </div>

          <Card className="mb-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                <CardTitle>{t('cookies.what_are_cookies')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('cookies.cookies_description')}
              </p>
            </CardContent>
            <CardHeader>
              <CardTitle>{t('cookies.cookies_we_use')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {t('cookies.only_essential_message')}
              </p>
              
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-3 dark:text-cyan-400">
                  {t('cookies.essential_cookies_title')}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('cookies.essential_cookies_description')}
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{t('cookies.purpose_authentication')}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{t('cookies.purpose_session')}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{t('cookies.purpose_preferences')}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{t('cookies.purpose_security')}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <CardTitle>{t('cookies.manage_cookies')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3">
                {t('cookies.manage_cookies_description')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('cookies.browser_settings_note')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('cookies.more_information')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('cookies.contact_message')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
