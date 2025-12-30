"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { ChallengeCategory } from "@/models/ChallengeCategory"
import { DraggableCategoryList } from "./draggable-category-list"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useSidebar,
} from "@/components/ui/sidebar"

type NavItem = {
  readonly title: string
  readonly url: string
  readonly icon?: LucideIcon
  readonly isActive?: boolean
  readonly ariaLabel?: string
  readonly items?: ReadonlyArray<{
    readonly title: string
    readonly url: string
  }>
  readonly draggableItems?: readonly ChallengeCategory[]
  readonly onReorderItems?: (items: ChallengeCategory[]) => void
}

// Collapsible menu item component - MODIFIÉ POUR L'ANIMATION
function CollapsibleNavItem({ item, open, isOpen, onOpenChange }: {
  readonly item: NavItem
  readonly open: boolean
  readonly isOpen: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      className="group/collapsible"
    >
      <div>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200",
              item.isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            {item.icon && <item.icon className="w-4 h-4 flex-shrink-0" />}
            <span className={cn(
              "truncate transition-all duration-200",
              open ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
            )}>
              {item.title}
            </span>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform duration-200 ease-in-out group-data-[state=open]/collapsible:rotate-90",
              open ? "opacity-100 ml-auto" : "opacity-0 w-0 overflow-hidden"
            )} />
          </button>
        </CollapsibleTrigger>
        
        {/* ICI: Animation fluide standard shadcn/radix */}
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="ml-6 mt-1">
            {item.draggableItems && item.onReorderItems ? (
              <DraggableCategoryList
                items={item.draggableItems.map(cat => ({
                  id: cat.id,
                  title: cat.name,
                  url: `/pwn/${cat.name}`,
                }))}
                onReorder={(newItems) => {
                  const reorderedCategories = newItems.map(newItem => 
                    item.draggableItems!.find(cat => cat.id === newItem.id)!
                  );
                  item.onReorderItems!(reorderedCategories);
                }}
              />
            ) : (
              <div className="space-y-1">
                {item.items?.map((subItem) => (
                  <Link
                    key={subItem.title}
                    href={subItem.url}
                    className="block rounded-lg p-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
                  >
                    {subItem.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// Dropdown menu item component
function DropdownNavItem({ item }: { readonly item: NavItem }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            item.isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          {item.icon && <item.icon className="w-4 h-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="min-w-48">
        {item.draggableItems ? (
          item.draggableItems.map((cat) => (
            <DropdownMenuItem asChild key={cat.name}>
              <Link href={`/pwn/${cat.name}`}>{cat.name}</Link>
            </DropdownMenuItem>
          ))
        ) : (
          item.items?.map((subItem) => (
            <DropdownMenuItem asChild key={subItem.title}>
              <Link href={subItem.url}>{subItem.title}</Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Simple link item component
function SimpleNavItem({ item, open }: { readonly item: NavItem; readonly open: boolean }) {
  return (
    <Link
      href={item.url}
      aria-label={item.ariaLabel || item.title}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200",
        item.isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      {item.icon && <item.icon className="w-4 h-4 flex-shrink-0" />}
      <span className={cn(
        "truncate transition-all duration-200",
        open ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
      )}>
        {item.title}
      </span>
    </Link>
  )
}

export function NavMain({
  items,
}: {
  readonly items: readonly NavItem[]
}) {
  const { open } = useSidebar()
  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set())

  const handleToggle = (title: string, isOpen: boolean) => {
    const newOpenItems = new Set(openItems)
    if (isOpen) {
      newOpenItems.add(title)
    } else {
      newOpenItems.delete(title)
    }
    setOpenItems(newOpenItems)
  }

  const renderNavItem = (item: NavItem) => {
    const hasSubItems = item.items && item.items.length > 0

    if (!hasSubItems) {
      return (
        <div key={item.title}>
          <SimpleNavItem item={item} open={open} />
        </div>
      )
    }

    if (open) {
      return (
        <CollapsibleNavItem
          key={item.title}
          item={item}
          open={open}
          isOpen={openItems.has(item.title)}
          onOpenChange={(isOpen) => handleToggle(item.title, isOpen)}
        />
      )
    }

    return (
      <div key={item.title}>
        <DropdownNavItem item={item} />
      </div>
    )
  }

  return (
    <div className="p-2">
      <div className="space-y-1">
        {items.map(renderNavItem)}
      </div>
    </div>
  )
}