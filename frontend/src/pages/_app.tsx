import App, { AppProps, AppContext } from 'next/app'
import { SidebarProvider, SidebarInset, SIDEBAR_COOKIE_NAME } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { AuthProvider } from '@/context/AuthContext'
import { UserProvider } from '@/context/UserContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { SiteConfigProvider } from '@/context/SiteConfigContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { ThemeProvider } from '@/components/theme-provider'
import '../styles/globals.css'
import { CookieConsent } from "@/components/ui/CookieConsent"
import { useEffect, useState, useRef } from 'react'
import { Toaster } from "@/components/ui/sonner"
import { useRouter } from 'next/router'


interface MyAppProps extends AppProps {
  sidebarDefaultOpen: boolean
}


function MyApp({ Component, pageProps, sidebarDefaultOpen }: MyAppProps) {
  const router = useRouter()
  const [windowWidth, setWindowWidth] = useState(0)
  const [systemTheme, setSystemTheme] = useState<'light' | 'slate'>('light')
  const resizeTimeoutRef = useRef<NodeJS.Timeout>()

  const MIN_WIDTH = 1024

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const updateTheme = () => setSystemTheme(mq.matches ? 'slate' : 'light')
      updateTheme()
      mq.addEventListener('change', updateTheme)
      return () => mq.removeEventListener('change', updateTheme)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      resizeTimeoutRef.current = setTimeout(() => {
        setWindowWidth(window.innerWidth)
      }, 300)
    }

    setWindowWidth(window.innerWidth)

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (windowWidth === 0) return

    const isTooSmall = windowWidth < MIN_WIDTH
    const isOnBlockedPage = router.pathname === '/mobile-blocked'

    if (isTooSmall && !isOnBlockedPage) {
      sessionStorage.setItem('returnPath', router.asPath)
      router.push('/mobile-blocked')
    }
    
    if (!isTooSmall && isOnBlockedPage) {
      const returnPath = sessionStorage.getItem('returnPath') || '/'
      sessionStorage.removeItem('returnPath')
      router.push(returnPath)
    }
  }, [windowWidth, router])

  if (router.pathname === '/mobile-blocked') {
    return <Component {...pageProps} />
  }

  // Render without sidebar for live scoreboard pages
  if (router.pathname.startsWith('/live')) {
    return (
      <LanguageProvider>
        <AuthProvider>
          <UserProvider>
            <SiteConfigProvider>
              <NotificationProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme={systemTheme}
                  enableSystem={false}
                  value={{
                    light: "light",
                    dark: "dark",
                    latte: "theme-latte",
                    frappe: "theme-frappe",
                    macchiato: "theme-macchiato",
                    mocha: "theme-mocha",
                    slate: "theme-slate",
                    rose: "theme-rose",
                    emerald: "theme-emerald",
                    cyan: "theme-cyan",
                    violet: "theme-violet",
                    orange: "theme-orange",
                    cyberpunk: "theme-cyberpunk",
                  }}
                >
                  <Component {...pageProps} />
                  <Toaster
                    richColors
                    position="top-right"
                    closeButton
                    expand
                  />
                </ThemeProvider>
              </NotificationProvider>
            </SiteConfigProvider>
          </UserProvider>
        </AuthProvider>
      </LanguageProvider>
    )
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <UserProvider>
          <SiteConfigProvider>
            <NotificationProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme={systemTheme}
                enableSystem={false}
                value={{
                  light: "light",
                  dark: "dark",
                  latte: "theme-latte",
                  frappe: "theme-frappe",
                  macchiato: "theme-macchiato",
                  mocha: "theme-mocha",
                  slate: "theme-slate",
                  rose: "theme-rose",
                  emerald: "theme-emerald",
                  cyan: "theme-cyan",
                  violet: "theme-violet",
                  orange: "theme-orange",
                  cyberpunk: "theme-cyberpunk",
                }}
              >
                <SidebarProvider defaultOpen={sidebarDefaultOpen}>
                  <AppSidebar />
                  <SidebarInset>
                    <Component {...pageProps} />
                    <CookieConsent />
                  </SidebarInset>
                </SidebarProvider>

                <Toaster
                  richColors
                  position="top-right"
                  closeButton
                  expand
                />
              </ThemeProvider>
            </NotificationProvider>
          </SiteConfigProvider>
        </UserProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}


MyApp.getInitialProps = async (appContext: AppContext) => {
  const appProps = await App.getInitialProps(appContext)
  let sidebarDefaultOpen = true
  const cookie = appContext.ctx.req?.headers.cookie
  if (cookie) {
    const match = cookie.match(new RegExp(`${SIDEBAR_COOKIE_NAME}=(true|false)`))
    if (match) sidebarDefaultOpen = match[1] === 'true'
  }
  return { ...appProps, sidebarDefaultOpen }
}


export default MyApp
