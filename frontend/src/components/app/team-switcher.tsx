"use client"

import * as React from "react"
import Link from 'next/link';

import {
  useSidebar,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { isMobile, open } = useSidebar()
  const [activeTeam, setActiveTeam] = React.useState(teams[0])

  // Update activeTeam when teams prop changes
  React.useEffect(() => {
    if (teams.length > 0) {
      setActiveTeam(teams[0])
    }
  }, [teams])

  if (!activeTeam) {
    return null
  }

  return (
    <div className="p-2">
      <Link href="/">
      <div className={`flex items-center rounded-lg p-2 transition-all duration-200 ${
        open ? 'gap-2' : 'justify-center'
      }`}>
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex-shrink-0">
                <activeTeam.logo className="size-4" />
              </div>
        {open && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
        )}
      </div>
        </Link>
                </div>
  )
}
