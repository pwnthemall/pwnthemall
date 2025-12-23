"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { PanelLeft, Menu } from "lucide-react"

// Sidebar context with proper functionality
type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  width: number
  setWidth: (width: number) => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

// Sidebar provider with width management
export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    defaultWidth?: number
  }
>(({ defaultOpen = true, defaultWidth = 256, children, ...props }, ref) => {
  const [open, setOpen] = React.useState(defaultOpen)
  const [isMobile, setIsMobile] = React.useState(false)
  
  const [width, setWidth] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarWidth')
      return saved ? Number(saved) : defaultWidth
    }
    return defaultWidth
  })

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarWidth', String(width))
    }
  }, [width])

  const toggleSidebar = React.useCallback(() => {
    setOpen(!open)
  }, [open])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault()
        toggleSidebar()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      isMobile,
      toggleSidebar,
      width,
      setWidth,
    }),
    [open, setOpen, isMobile, toggleSidebar, width, setWidth]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div ref={ref} className="flex h-screen w-full" {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
})
SidebarProvider.displayName = "SidebarProvider"

// Sidebar trigger button
export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      onClick={toggleSidebar}
      className={cn(
        "sidebar-trigger inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors",
        className
      )}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

// Burger menu button component (exported for use in app-sidebar)
export const SidebarBurger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Toggle sidebar"
      className={cn(
        "sidebar-burger flex items-center justify-center w-7 h-7 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors border-0 p-1 flex-shrink-0",
        className
      )}
      onClick={toggleSidebar}
      title="Toggle sidebar"
      {...props}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle sidebar</span>
    </button>
  )
})
SidebarBurger.displayName = "SidebarBurger"

// Main sidebar component
export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    collapsible?: "icon" | "none"
  }
>(({ collapsible = "icon", className, children, ...props }, ref) => {
  const { open, isMobile, width, setWidth, setOpen } = useSidebar()

  if (isMobile) {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        <div className="flex flex-col h-full">
          {children}
        </div>
      </div>
    )
  }

  let sidebarWidth = width
  if (!open) {
    sidebarWidth = collapsible === "icon" ? 64 : width
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground",
        "transition-all duration-300 ease-in-out",
        className
      )}
      style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      {...props}
    >
      {children}
    </div>
  )
})
Sidebar.displayName = "Sidebar"

// Sidebar header
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-1 px-3 py-2",
        className
      )}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

// Sidebar content
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()

  return (
    <div
      ref={ref}
      className={cn(
        "flex-1 p-2 overflow-y-auto overflow-x-hidden",
        "scrollbar-thin scrollbar-track-sidebar scrollbar-thumb-sidebar-accent hover:scrollbar-thumb-sidebar-accent/80",
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

// Sidebar footer
export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  
  return (
    <div
      ref={ref}
      className={cn(
        "p-2 mt-auto flex-shrink-0",
        !open && "items-center",
        className
      )}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

// Sidebar inset (main content area)
export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex-1 overflow-y-auto overflow-x-hidden h-screen",
      "scrollbar-thin scrollbar-track-background scrollbar-thumb-border hover:scrollbar-thumb-border/80",
      className
    )}
    {...props}
  />
))
SidebarInset.displayName = "SidebarInset"

// Simple sidebar menu components
export const SidebarMenu = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    size?: "sm" | "md" | "lg"
  }
>(({ className, size = "md", ...props }, ref) => {
  const { open } = useSidebar()

  return (
    <button
      ref={ref}
      className={cn(
        "flex items-center gap-2 w-full text-left rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
        size === "sm" && "px-2 py-1 text-sm",
        size === "md" && "px-3 py-2",
        size === "lg" && "px-4 py-3",
        !open && "justify-center px-2",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SIDEBAR_COOKIE_NAME = "sidebar_state"