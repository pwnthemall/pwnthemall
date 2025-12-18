"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { PanelLeft } from "lucide-react"

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
  // Initialize width from localStorage immediately to prevent flash
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

  // Width is now initialized synchronously above, no need for this effect

  // Save width to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarWidth', String(width))
    }
  }, [width])

  const toggleSidebar = React.useCallback(() => {
    setOpen(!open)
  }, [open])

  // Add keyboard shortcut for Ctrl+B
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
        "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors",
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

// Resize handle component with truly instant DOM updates
const ResizeHandle = ({ onResize, onToggle }: { 
  onResize: (width: number) => void
  onToggle: () => void 
}) => {
  const isResizing = React.useRef(false)
  const startX = React.useRef(0)
  const startWidth = React.useRef(0)
  const hasDragged = React.useRef(false)
  const sidebarElement = React.useRef<HTMLElement | null>(null)

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    
    // Get reference to the sidebar element
    sidebarElement.current = e.currentTarget.parentElement as HTMLElement
    
    if (!sidebarElement.current) return
    
    // Store initial values
    startX.current = e.clientX
    startWidth.current = sidebarElement.current.offsetWidth
    hasDragged.current = false
    isResizing.current = true
    
    // Disable transitions during resize for instant updates
    sidebarElement.current.style.transition = 'none'
    
    // Set cursor immediately
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current || !sidebarElement.current) return
      
      const deltaX = moveEvent.clientX - startX.current
      const newWidth = Math.max(200, Math.min(500, startWidth.current + deltaX))
      
      // Mark as dragged if moved more than 3px
      if (Math.abs(deltaX) > 3) {
        hasDragged.current = true
      }
      
      // Apply width changes directly and immediately (no transitions, no delays)
      sidebarElement.current.style.width = `${newWidth}px`
      sidebarElement.current.style.minWidth = `${newWidth}px`
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      

      
      if (sidebarElement.current) {
        // Re-enable transitions
        sidebarElement.current.style.transition = ''
        
        // If no significant drag occurred, treat as click to toggle
        if (!hasDragged.current) {
          onToggle() // This will toggle between collapse and expand
        } else {
          // Update React state with final width only after drag is complete
          const finalWidth = sidebarElement.current.offsetWidth
          onResize(finalWidth)
        }
      }
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onResize, onToggle])

  return (
    <button
      type="button"
      aria-label="Resize sidebar"
      className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-border/50 transition-colors z-10 flex items-center justify-center group border-0 bg-transparent p-0"
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        // Only toggle on actual click, not during drag
        if (e.detail === 1) {
          onToggle?.();
        }
      }}
      title="Drag to resize, click to toggle"
    >
      {/* Visual indicator */}
      <div className="w-0.5 h-8 bg-border rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

// Main sidebar component with proper scrolling and resize
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
        "relative flex flex-col bg-sidebar text-sidebar-foreground",
        // Only apply transitions when not resizing (will be controlled by JS)
        "transition-all duration-300 ease-in-out",
        className
      )}
      style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      {...props}
    >
      <div className="flex flex-col h-full">
        {children}
      </div>
      {open && collapsible !== "none" && (
        <ResizeHandle onResize={setWidth} onToggle={() => setOpen(!open)} />
      )}
      {!open && collapsible === "icon" && (
        <ResizeHandle onResize={setWidth} onToggle={() => setOpen(!open)} />
      )}
    </div>
  )
})
Sidebar.displayName = "Sidebar"

// Sidebar header
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 p-2",
        !open && "items-center",
        className
      )}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

// Sidebar content with proper scrolling
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
    <div
    ref={ref}
      className={cn(
      "flex-1 p-2 overflow-y-auto overflow-x-hidden",
      // Ensure scrollbar is visible when needed
      "scrollbar-thin scrollbar-track-sidebar scrollbar-thumb-sidebar-accent hover:scrollbar-thumb-sidebar-accent/80",
        className
      )}
      {...props}
    />
))
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
      // Apply custom scrollbar to main content
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

// Export cookie name for compatibility
export const SIDEBAR_COOKIE_NAME = "sidebar_state"
