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
import { Toaster } from 'sonner'
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

  const themes = [
    'light',
    'dark',
    'latte',
    'macchiato',
    'mocha',
    'slate',
    'emerald',
    'violet',
    'orange',
    'cyberpunk'
  ]

  return (
    <LanguageProvider>
      <SiteConfigProvider>
        <AuthProvider>
          <UserProvider>
            <NotificationProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme={systemTheme}
                themes={themes}
                enableSystem
                disableTransitionOnChange
              >
                <Toaster position="top-right" richColors />
                {router.pathname === '/mobile-blocked' ? (
                  <Component {...pageProps} />
                ) : router.pathname.startsWith('/live') ? (
                  <Component {...pageProps} />
                ) : router.pathname === '/login' || router.pathname === '/register' ? (
                  <Component {...pageProps} />
                ) : (
                  <SidebarProvider defaultOpen={sidebarDefaultOpen}>
                    <AppSidebar />
                    <SidebarInset>
                      <Component {...pageProps} />
                    </SidebarInset>
                  </SidebarProvider>
                )}
              </ThemeProvider>
            </NotificationProvider>
          </UserProvider>
        </AuthProvider>
      </SiteConfigProvider>
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
