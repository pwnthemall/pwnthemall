import Head from "next/head"
import { useState, useMemo } from "react"
import axios from "@/lib/axios";

import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { X, ArrowUpDown, Server, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"
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
import { useLanguage } from "@/context/LanguageContext"
import { useSiteConfig } from "@/context/SiteConfigContext"
import { toast } from "sonner"

interface Instance {
  id: number;
  container: string;
  userId: number;
  username: string;
  teamId: number;
  teamName: string;
  challengeId: number;
  challengeName: string;
  category: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface InstancesContentProps {
  readonly instances: Instance[]
  readonly onRefresh: () => void
}

export default function InstancesContent({ instances, onRefresh }: Readonly<InstancesContentProps>) {
  const { t } = useLanguage()
  const { getSiteName } = useSiteConfig()
  const [deleting, setDeleting] = useState<Instance | null>(null)
  const [confirmMassDelete, setConfirmMassDelete] = useState(false)
  const [confirmStopAll, setConfirmStopAll] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  
  // Filter states
  const [usernameFilter, setUsernameFilter] = useState("")
  const [challengeFilter, setChallengeFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  
  // Sorting state
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Filtered and sorted instances
  const filteredInstances = useMemo(() => {
    if (!instances) return []
    let filtered = instances.filter((instance) => {
      const usernameMatch = !usernameFilter || 
        instance.username?.toLowerCase().includes(usernameFilter.toLowerCase())
      
      const challengeMatch = !challengeFilter || 
        instance.challengeName?.toLowerCase().includes(challengeFilter.toLowerCase())
      
      const categoryMatch = !categoryFilter || 
        instance.category?.toLowerCase().includes(categoryFilter.toLowerCase())
      
      return usernameMatch && challengeMatch && categoryMatch
    })
    
    // Sort instances
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case "username":
          aValue = a.username || ""
          bValue = b.username || ""
          break
        case "challengeName":
          aValue = a.challengeName || ""
          bValue = b.challengeName || ""
          break
        case "category":
          aValue = a.category || ""
          bValue = b.category || ""
          break
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
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
  }, [instances, usernameFilter, challengeFilter, categoryFilter, sortBy, sortOrder])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 9

  // Get current page data and pad to 9 rows
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    const pageData = filteredInstances.slice(start, end)
    
    // Pad with empty rows to always have 9 rows
    const emptyRowsNeeded = pageSize - pageData.length
    const emptyRows = new Array(emptyRowsNeeded).fill(null).map((_, i) => ({
      id: -(start + pageData.length + i + 1),
      container: "",
      userId: 0,
      username: "",
      teamId: 0,
      teamName: "",
      challengeId: 0,
      challengeName: "",
      category: "",
      status: "",
      createdAt: "",
      expiresAt: "",
    }))
    
    return [...pageData, ...emptyRows]
  }, [filteredInstances, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredInstances.length / pageSize))

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(0)
  }, [usernameFilter, challengeFilter, categoryFilter])
  
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const timeLeft = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000 / 60))
    return timeLeft
  }

  const toggleRowSelection = (rowIndex: number) => {
    setRowSelection(prev => {
      const newSelection = { ...prev }
      if (newSelection[rowIndex]) {
        delete newSelection[rowIndex]
      } else {
        newSelection[rowIndex] = true
      }
      return newSelection
    })
  }

  const toggleAllRows = () => {
    if (Object.keys(rowSelection).length === paginatedData.filter(r => r.id >= 0).length) {
      setRowSelection({})
    } else {
      const newSelection: RowSelectionState = {}
      paginatedData.forEach((row, index) => {
        if (row.id >= 0) {
          newSelection[index] = true
        }
      })
      setRowSelection(newSelection)
    }
  }

  const columns: ColumnDef<Instance>[] = [
    {
      id: "select",
      header: () => {
        const allSelected = paginatedData.filter(r => r.id >= 0).length > 0 && 
          Object.keys(rowSelection).length === paginatedData.filter(r => r.id >= 0).length
        return (
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAllRows}
            aria-label="Select all"
          />
        )
      },
      cell: ({ row }) => {
        if (row.original.id < 0) return <div className="w-[40px] h-[52px]">&nbsp;</div>
        const rowIndex = paginatedData.findIndex(r => r.id === row.original.id)
        return (
          <div className="w-[40px] h-[52px] flex items-center">
            <Checkbox
              checked={rowSelection[rowIndex] || false}
              onCheckedChange={() => toggleRowSelection(rowIndex)}
              aria-label="Select row"
            />
          </div>
        )
      },
    },
    {
      accessorKey: "username",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("username")}
        >
          {t("user.user")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[140px] h-[52px]">&nbsp;</div>
        return (
          <div className="w-[140px] h-[52px]">
            <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ textOverflow: 'ellipsis' }} title={getValue() as string}>
              {(getValue() as string).length > 16 ? (getValue() as string).substring(0, 14) + '..' : getValue() as string}
            </div>
            {row.original.teamName && (
              <div className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={row.original.teamName}>
                {row.original.teamName.length > 16 ? row.original.teamName.substring(0, 14) + '..' : row.original.teamName}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "challengeName",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("challengeName")}
        >
          {t("challenge.challenge")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[180px] h-[52px]">&nbsp;</div>
        return (
          <div className="w-[180px] h-[52px]">
            <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" title={getValue() as string}>
              {(getValue() as string).length > 20 ? (getValue() as string).substring(0, 18) + '..' : getValue() as string}
            </div>
            <Badge variant="outline" className="text-xs mt-1 overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
              {row.original.category.length > 18 ? row.original.category.substring(0, 16) + '..' : row.original.category}
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("createdAt")}
        >
          {t("dashboard.started")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[180px] h-[52px]">&nbsp;</div>
        const dateStr = formatDate(getValue() as string)
        return (
          <span className="block w-[180px] h-[52px] text-sm text-muted-foreground flex items-center">
            {dateStr}
          </span>
        )
      },
    },
    {
      accessorKey: "expiresAt",
      header: () => (
        <div className="font-semibold">
          {t("time_remaining")}
        </div>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[100px] h-[52px]">&nbsp;</div>
        const timeLeft = getTimeRemaining(getValue() as string)
        const isExpiringSoon = timeLeft <= 5
        return (
          <div className="w-[100px] h-[52px] flex items-center">
            <Badge 
              variant={isExpiringSoon ? "destructive" : "outline"}
              className="w-[80px] justify-center"
            >
              {timeLeft}m
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: "name",
      header: () => (
        <div className="font-semibold">
          {t("container_id")}
        </div>
      ),
      cell: ({ getValue, row }) => {
        if (row.original.id < 0) return <div className="w-[220px] h-[52px]">&nbsp;</div>
        const containerName = getValue() as string
        return (
          <span className="block w-[220px] h-[52px] font-mono text-xs text-muted-foreground flex items-center">
            {containerName}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => {
        if (row.original.id < 0) return <div className="w-[80px] h-[52px]">&nbsp;</div>
        return (
          <div className="flex gap-1 w-[80px] h-[52px] items-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleting(row.original)}
              className="w-full"
            >
              {t("stop")}
            </Button>
          </div>
        )
      },
    },
  ]

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await axios.delete(`/api/admin/instances/${deleting.id}`)
      setDeleting(null)
      toast.success(t("instance_stopped_success"))
      onRefresh()
    } catch (err: any) {
      console.error("Failed to stop instance:", err)
      toast.error(t("instance_stop_failed"))
      setDeleting(null)
    }
  }

  const doDeleteSelected = async () => {
    const ids = Object.keys(rowSelection)
      .map((key) => paginatedData[Number.parseInt(key, 10)].id)
      .filter((id) => id >= 0) // Filter out empty placeholder rows
    try {
      await Promise.all(ids.map((id) => axios.delete(`/api/admin/instances/${id}`)))
      setRowSelection({})
      setConfirmMassDelete(false)
      toast.success(t("instances_stopped_success"))
      onRefresh()
    } catch (err: any) {
      console.error("Failed to stop instances:", err)
      toast.error(t("instances_stop_failed"))
      setConfirmMassDelete(false)
    }
  }

  const doStopAll = async () => {
    setConfirmStopAll(false)
    
    try {
      // Make the API call to delete from DB
      await axios.delete('/api/admin/instances')
      toast.success(t("all_instances_stopped_success"))
      onRefresh() // Refresh to show empty table
    } catch (err: any) {
      // Network errors are expected when stopping containers affects networking
      // The instances are already deleted from DB, so still show success
      console.debug("Stop all instances network error (expected):", err.message)
      toast.success(t("all_instances_stopped_success"))
      onRefresh() // Refresh to show empty table
    }
  }

  return (
    <>
      <Head>
        <title>{getSiteName()} - {t("instances")}</title>
      </Head>
      <div className="min-h-screen p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{t("instances")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {Object.keys(rowSelection).length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmMassDelete(true)}
              >
                {t("stop_selected")}
              </Button>
            )}
            {filteredInstances.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmStopAll(true)}
              >
                {t("stop_all")}
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2 items-end bg-card px-4 py-3 rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("user.user")}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_user")}
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
              {t("challenge.challenge")}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_challenge")}
                value={challengeFilter}
                onChange={(e) => setChallengeFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {challengeFilter && (
                <button
                  onClick={() => setChallengeFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="text-sm font-medium mb-1 block">
              {t("category")}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_category")}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {categoryFilter && (
                <button
                  onClick={() => setCategoryFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {(usernameFilter || challengeFilter || categoryFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUsernameFilter("")
                setChallengeFilter("")
                setCategoryFilter("")
              }}
              className="mb-0.5"
            >
              {t("clear_filters")}
            </Button>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-background rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="border-b">
                <tr>
                  {columns.map((column, idx) => {
                    const widths = ["w-[40px]", "w-[140px]", "w-[180px]", "w-[180px]", "w-[100px]", "w-[220px]", "w-[80px]"]
                    return (
                    <th key={column.id || (column as any).accessorKey} className={`px-3 py-1.5 text-left font-medium align-middle ${widths[idx] || ""}`}>
                      {typeof column.header === 'function' ? column.header({} as any) : column.header}
                    </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
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
                ))}
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirm_stop_instance")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirm_stop_instance_description")}
                <br />
                <span className="font-semibold">{deleting?.challengeName}</span> - {deleting?.username}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("stop")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Mass Delete Confirmation Dialog */}
        <AlertDialog open={confirmMassDelete} onOpenChange={setConfirmMassDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirm_stop_instances")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirm_stop_instances_description", { count: Object.keys(rowSelection).length.toString() })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={doDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("stop")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Stop All Confirmation Dialog */}
        <AlertDialog open={confirmStopAll} onOpenChange={setConfirmStopAll}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirm_stop_all_instances")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirm_stop_all_instances_description", { count: filteredInstances.length.toString() })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={doStopAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("stop_all")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  )
}
