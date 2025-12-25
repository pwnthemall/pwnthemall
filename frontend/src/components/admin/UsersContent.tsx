import Head from "next/head"
import { useState, useMemo, useEffect } from "react"
import axios from "@/lib/axios";

import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { X, ArrowUpDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, User as LucideUser } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import UserForm from "./UserForm"
import { User, UserFormData } from "@/models/User"
import { useLanguage } from "@/context/LanguageContext"
import { useSiteConfig } from "@/context/SiteConfigContext"
import { toast } from "sonner"

interface UsersContentProps {
  users: User[]
  onRefresh: () => void
}

export default function UsersContent({ users, onRefresh }: UsersContentProps) {
  const { t, isLoaded, language } = useLanguage()
  const { getSiteName } = useSiteConfig()
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [tempBanning, setTempBanning] = useState<User | null>(null)
  const [confirmMassDelete, setConfirmMassDelete] = useState(false)
  const [confirmMassBan, setConfirmMassBan] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [createError, setCreateError] = useState<string | null>(null)
  
  // Filter states
  const [usernameFilter, setUsernameFilter] = useState("")
  const [emailFilter, setEmailFilter] = useState("")
  const [teamFilter, setTeamFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("") // "banned" | "active" | ""
  
  // Sorting state
  const [sortBy, setSortBy] = useState("id")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter((user) => {
      const usernameMatch = !usernameFilter || 
        user.username?.toLowerCase().includes(usernameFilter.toLowerCase())
      
      const emailMatch = !emailFilter || 
        user.email?.toLowerCase().includes(emailFilter.toLowerCase())
      
      const teamMatch = !teamFilter || 
        user.team?.name?.toLowerCase().includes(teamFilter.toLowerCase())
      
      const statusMatch = !statusFilter || 
        (statusFilter === "banned" && user.banned) || 
        (statusFilter === "active" && !user.banned)
      
      return usernameMatch && emailMatch && teamMatch && statusMatch
    })
    
    // Sort users
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case "username":
          aValue = a.username || ""
          bValue = b.username || ""
          break
        case "email":
          aValue = a.email || ""
          bValue = b.email || ""
          break
        case "team":
          aValue = a.team?.name || ""
          bValue = b.team?.name || ""
          break
        case "role":
          aValue = a.role || ""
          bValue = b.role || ""
          break
        case "banned":
          aValue = a.banned ? 1 : 0
          bValue = b.banned ? 1 : 0
          break
        default:
          return 0
      }
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue, 'en', { sensitivity: 'base' })
        return sortOrder === "asc" ? comparison : -comparison
      } else {
        const comparison = aValue - bValue
        return sortOrder === "asc" ? comparison : -comparison
      }
    })
    
    return filtered
  }, [users, usernameFilter, emailFilter, teamFilter, statusFilter, sortBy, sortOrder])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 9

  // Get current page data and pad to 9 rows
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    const pageData = filteredUsers.slice(start, end)
    
    // Pad with empty rows to always have 9 rows
    const emptyRowsNeeded = pageSize - pageData.length
    const emptyRows = new Array(emptyRowsNeeded).fill(null).map((_, i) => ({
      id: -(start + pageData.length + i + 1),
      username: "",
      email: "",
      team: null,
      role: "",
      banned: false,
      ipAddresses: [],
      createdAt: "",
      updatedAt: "",
    }))
    
    return [...pageData, ...emptyRows]
  }, [filteredUsers, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(0)
  }, [usernameFilter, emailFilter, teamFilter, statusFilter])
  
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "username",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("username")}
        >
          {t("username")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[120px] h-[52px]">&nbsp;</div>
        return (
          <span className="block w-[120px] h-[52px] truncate flex items-center" title={getValue() as string}>
            {getValue() as string}
          </span>
        )
      },
    },
    {
      accessorKey: "email",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("email")}
        >
          {t("email")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[150px] h-[52px]">&nbsp;</div>
        return (
          <span className="block w-[150px] h-[52px] truncate flex items-center" title={getValue() as string}>
            {getValue() as string}
          </span>
        )
      },
    },
    {
      accessorKey: "team",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("team")}
        >
          {t("team")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        if (row.original.id < 0) return <div className="w-[100px] h-[52px]">&nbsp;</div>
        const team = row.original.team;
        return (
          <span className="block w-[100px] h-[52px] truncate flex items-center" title={team ? team.name : "N/A"}>
            {team ? team.name : "N/A"}
          </span>
        );
      },
    },
    {
      accessorKey: "ipAddresses",
      header: "IP Addresses",
      cell: ({ row }) => {
        if (row.original.id < 0) return <div className="w-[120px] h-[52px]">&nbsp;</div>
        const ipAddresses = row.original.ipAddresses;
        if (!ipAddresses || ipAddresses.length === 0) {
          return <div className="w-[120px] h-[52px] flex items-center"><span className="text-muted-foreground">-</span></div>;
        }
        
        const displayIPs = ipAddresses.slice(0, 2); // Show first 2 IPs
        const remainingCount = ipAddresses.length - displayIPs.length;
        
        return (
          <div className="w-[120px] h-[52px] flex items-center">
            <div className="flex flex-wrap gap-1">
              {displayIPs.map((ip, index) => (
                <span 
                  key={index}
                  className="inline-block px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-md font-mono"
                  title={ip}
                >
                  {ip}
                </span>
              ))}
              {remainingCount > 0 && (
                <span 
                  className="inline-block px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md font-mono"
                  title={`${remainingCount} more IP${remainingCount > 1 ? 's' : ''}: ${ipAddresses.slice(2).join(', ')}`}
                >
                  +{remainingCount}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("role")}
        >
          {t("role")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[80px] h-[52px]">&nbsp;</div>
        return (
          <span className="block w-[80px] h-[52px] flex items-center">
            {getValue() as string}
          </span>
        )
      },
    },
    {
      accessorKey: "banned",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("banned")}
        >
          {t("banned")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[60px] h-[52px]">&nbsp;</div>
        const isBanned = getValue() as boolean
        return (
          <div className="w-[60px] h-[52px] flex items-center">
            <span className={cn("font-semibold", isBanned ? "text-red-600" : "text-green-600")}>
              {isBanned ? t("yes") : t("no")}
            </span>
          </div>
        )
      },
    },
{
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => {
        if (row.original.id < 0) return <div className="w-[240px] h-[52px]">&nbsp;</div>
        return (
          <div className="flex gap-1 w-[240px] min-h-[52px] items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingUser(row.original)}
            >
              {t("edit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTempBanning(row.original)}
            >
              {row.original.banned ? t("unban") : t("temp_ban")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleting(row.original)}
            >
              {t("delete")}
            </Button>
          </div>
        )
      },
    },
  ]

  const handleCreate = async (data: UserFormData) => {
    setCreateError(null)
    try {
      await axios.post("/api/users", data)
      setCreating(false)
      toast.success(t("user_created_success"))
      onRefresh()
    } catch (err: any) {
      let msg = err?.response?.data?.error || "Failed to create user";
      
      // Wait for translations to load before processing
      if (!isLoaded) {
        setCreateError("Failed to create user.");
        return;
      }
      
      // Map backend error messages to user-friendly messages using locale keys
      if (msg.match(/validation.*Password.*min/)) {
        msg = t('password_too_short') || "Password must be at least 8 characters.";
      } else if (msg.match(/validation.*Password.*max/)) {
        msg = t('password_length') || "Password must be between 8 and 72 characters.";
      } else if (msg.match(/validation.*Username.*max/)) {
        msg = t('username_length') || "Username must be at most 32 characters.";
      } else if (msg.match(/validation.*Email.*max/)) {
        msg = t('email_length') || "Email must be at most 254 characters.";
      } else if (msg.match(/validation.*Email.*email/)) {
        msg = t('invalid_email') || "Invalid email address.";
      } else if (msg.includes("duplicate key") && msg.includes("username")) {
        msg = t('username_exists') || "Username already exists.";
      } else if (msg.includes("duplicate key") && msg.includes("email")) {
        msg = t('email_exists') || "Email already exists.";
      } else if (msg.includes("unique constraint failed") && msg.toLowerCase().includes("username")) {
        msg = t('username_exists') || "Username already exists.";
      } else if (msg.includes("unique constraint failed") && msg.toLowerCase().includes("email")) {
        msg = t('email_exists') || "Email already exists.";
      } else if (msg.includes("SQLSTATE 23505") && msg.includes("uni_users_username")) {
        msg = t('username_exists') || "Username already exists.";
      } else if (msg.includes("SQLSTATE 23505") && msg.includes("uni_users_email")) {
        msg = t('email_exists') || "Email already exists.";
      } else {
        msg = t('user_create_failed') || "Failed to create user.";
      }
      
      
      setCreateError(msg)
    }
  }

  const handleUpdate = async (data: UserFormData) => {
    if (!editingUser) return
    await axios.put(`/api/users/${editingUser.id}`, data)
    setEditingUser(null)
    toast.success(t("user_updated_success"))
    onRefresh()
  }

  const handleDelete = async () => {
    if (!deleting) return
    await axios.delete(`/api/users/${deleting.id}`)
    setDeleting(null)
    toast.success(t("user_deleted_success"))
    onRefresh()
  }

  const doDeleteSelected = async () => {
    const ids = Object.keys(rowSelection)
      .map((key) => filteredUsers[Number.parseInt(key, 10)].id)
      .filter((id) => id >= 0) // Filter out empty placeholder rows
    await Promise.all(ids.map((id) => axios.delete(`/api/users/${id}`)))
    setRowSelection({})
    setConfirmMassDelete(false)
    toast.success(t("users_deleted_success"))
    onRefresh()
  }

  const doTempBanSelected = async () => {
    const selectedUsers = Object.keys(rowSelection)
      .map((key) => filteredUsers[Number.parseInt(key, 10)])
      .filter((user) => user.id >= 0) // Filter out empty placeholder rows
    const ids = selectedUsers.map(user => user.id)
    const bannedCount = selectedUsers.filter(user => user.banned).length
    const unbannedCount = selectedUsers.length - bannedCount
    const isMostlyUnbanning = bannedCount > unbannedCount
    
    try {
      await Promise.all(ids.map((id) => axios.post(`/api/users/${id}/ban`)))
      setRowSelection({})
      setConfirmMassBan(false)
      toast.success(isMostlyUnbanning ? t("users_unbanned_success") : t("users_banned_success"))
      onRefresh()
    } catch (err: any) {
      console.error("Failed to mass ban/unban users:", err)
      setRowSelection({})
      setConfirmMassBan(false)
    }
  }

  const doTempBanUser = async () => {
    if (!tempBanning) return
    try {
      await axios.post(`/api/users/${tempBanning.id}/ban`)
      const successMessage = tempBanning.banned ? t("user_unbanned_success") : t("user_banned_success")
      setTempBanning(null)
      toast.success(successMessage)
      onRefresh()
    } catch (err: any) {
      console.error("Failed to ban/unban user:", err)
      setTempBanning(null)
    }
  }

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
      <div className="min-h-screen p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("users")}</h1>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 h-9",
                Object.keys(rowSelection).length === 0 && "invisible"
              )}
            >
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmMassDelete(true)}
              >
                {t("delete_selected")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmMassBan(true)}
              >
                {(() => {
                  const selectedUsers = Object.keys(rowSelection)
                    .map((key) => filteredUsers[Number.parseInt(key, 10)])
                    .filter(user => user.id >= 0)
                  const bannedCount = selectedUsers.filter(user => user.banned).length
                  const unbannedCount = selectedUsers.length - bannedCount
                  return bannedCount > unbannedCount ? t("unban_users") : t("temp_ban_users")
                })()}
              </Button>
            </div>
            <Sheet open={creating} onOpenChange={setCreating}>
              <SheetTrigger asChild>
                <Button size="sm">{t("new_user")}</Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <SheetHeader>
                  <SheetTitle>{t("create_user")}</SheetTitle>
                </SheetHeader>
                <UserForm onSubmit={handleCreate} apiError={createError} />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2 items-end bg-card p-4 rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("username") || "Username"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_user") || "Filter by user..."}
                value={usernameFilter}
                onChange={(e) => setUsernameFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {usernameFilter && (
                <button
                  onClick={() => setUsernameFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("email") || "Email"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_email") || "Filter by email..."}
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {emailFilter && (
                <button
                  onClick={() => setEmailFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="text-sm font-medium mb-1 block">
              {t("team") || "Team"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_team") || "Filter by team..."}
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {teamFilter && (
                <button
                  onClick={() => setTeamFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="text-sm font-medium mb-1 block">
              {t("status") || "Status"}
            </label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">{t("all") || "All"}</option>
                <option value="active">{t("active") || "Active"}</option>
                <option value="banned">{t("banned") || "Banned"}</option>
              </select>
            </div>
          </div>

          {(usernameFilter || emailFilter || teamFilter || statusFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUsernameFilter("")
                setEmailFilter("")
                setTeamFilter("")
                setStatusFilter("")
              }}
              className="mb-0.5"
            >
              {t("clear") || "Clear"} {t("all") || "All"}
            </Button>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-background rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="w-[48px] px-3 py-1.5 align-middle text-center">
                    {/* Select all checkbox disabled - select individual rows only */}
                  </th>
                  {columns.map((column) => (
                    <th key={column.id || (column as any).accessorKey} className="px-3 py-1.5 text-left font-medium align-middle">
                      {typeof column.header === 'function' ? column.header({} as any) : column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row) => {
                  const rowIndex = filteredUsers.findIndex(fu => fu.id === row.id)
                  const isSelected = rowIndex >= 0 && rowSelection[rowIndex]
                  return (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="w-[48px] px-3 py-2 align-middle text-center">
                        {row.id >= 0 ? (
                          <Checkbox
                            aria-label="Select row"
                            checked={isSelected || false}
                            onCheckedChange={(value) => {
                              const newSelection = { ...rowSelection }
                              if (value) {
                                newSelection[rowIndex] = true
                              } else {
                                delete newSelection[rowIndex]
                              }
                              setRowSelection(newSelection)
                            }}
                          />
                        ) : (
                          <div className="h-5">&nbsp;</div>
                        )}
                      </td>
                      {columns.map((column) => {
                        const cellKey = column.id || (column as any).accessorKey
                        const cellContent = typeof column.cell === 'function' 
                          ? column.cell({ 
                              row: { original: row } as any, 
                              getValue: () => (row as any)[(column as any).accessorKey || ''] 
                            } as any)
                          : null
                        return (
                          <td key={cellKey} className="px-3 py-2 align-middle">
                            {cellContent}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* Fixed Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{t("edit_user")}</SheetTitle>
          </SheetHeader>
          {editingUser && (
            <UserForm
              isEdit
              initialData={{
                username: editingUser.username,
                email: editingUser.email,
                role: editingUser.role,
              }}
              onSubmit={handleUpdate}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_user")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_user_confirm", { username: deleting?.username || "" }) || `Are you sure you want to delete ${deleting?.username}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temp Ban/Unban Dialog */}
      <AlertDialog open={!!tempBanning} onOpenChange={(o) => !o && setTempBanning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tempBanning?.banned ? t("unban_user") : t("temp_ban_user")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tempBanning?.banned 
                ? t("unban_user_confirm", { username: tempBanning?.username || "" })
                : t("temp_ban_user_confirm", { username: tempBanning?.username || "" })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doTempBanUser}>
              {tempBanning?.banned ? t("unban") : t("temp_ban")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Mass Delete */}
      <AlertDialog open={confirmMassDelete} onOpenChange={setConfirmMassDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_users")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_users_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteSelected}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Mass Temp Ban/Unban */}
      <AlertDialog open={confirmMassBan} onOpenChange={setConfirmMassBan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const selectedUsers = Object.keys(rowSelection)
                  .map((key) => filteredUsers[Number.parseInt(key, 10)])
                  .filter(user => user.id >= 0)
                const bannedCount = selectedUsers.filter(user => user.banned).length
                const unbannedCount = selectedUsers.length - bannedCount
                return bannedCount > unbannedCount ? t("unban_users") : t("temp_ban_users")
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const selectedUsers = Object.keys(rowSelection)
                  .map((key) => filteredUsers[Number.parseInt(key, 10)])
                  .filter(user => user.id >= 0)
                const bannedCount = selectedUsers.filter(user => user.banned).length
                const unbannedCount = selectedUsers.length - bannedCount
                return bannedCount > unbannedCount ? t("unban_users_confirm") : t("temp_ban_users_confirm")
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doTempBanSelected}>
              {(() => {
                const selectedUsers = Object.keys(rowSelection)
                  .map((key) => filteredUsers[Number.parseInt(key, 10)])
                  .filter(user => user.id >= 0)
                const bannedCount = selectedUsers.filter(user => user.banned).length
                const unbannedCount = selectedUsers.length - bannedCount
                return bannedCount > unbannedCount ? t("unban") : t("temp_ban")
              })()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
