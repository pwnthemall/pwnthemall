"use client"

import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

import { cn } from "@/lib/utils"
import {
  useSidebar,
} from "@/components/ui/sidebar"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const { isMobile, open } = useSidebar()

  if (!open) {
    return null // Hide projects section when collapsed
  }

  return (
    <div className="p-2">
      <div className="mb-2">
        <h2 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wide px-2">
          Projects
        </h2>
      </div>
      <div className="space-y-1">
        {projects.map((item) => (
          <div key={item.name} className="group relative">
            <Link
              href={item.url}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="sr-only">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="w-4 h-4 text-muted-foreground" />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <MoreHorizontal className="w-4 h-4" />
            <span>More</span>
        </button>
      </div>
    </div>
  )
}
