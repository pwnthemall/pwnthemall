import { useState } from "react"
import axios from "@/lib/axios";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
import ChallengeDifficultiesForm from "./ChallengeDifficultiesForm"
import { ChallengeDifficulty, ChallengeDifficultyFormData } from "@/models/ChallengeDifficulty"
import { useLanguage } from "@/context/LanguageContext"

interface ChallengeDifficultiesContentProps {
  challengeDifficulties: ChallengeDifficulty[]
  onRefresh: () => void
}

export default function ChallengeDifficultiesContent({ challengeDifficulties, onRefresh }: ChallengeDifficultiesContentProps) {
  const { t } = useLanguage();
  const [editingChallengeDifficulty, setEditingChallengeDifficulty] = useState<ChallengeDifficulty | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ChallengeDifficulty | null>(null)
  const [confirmMassDelete, setConfirmMassDelete] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const getTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const columns: ColumnDef<ChallengeDifficulty>[] = [
    { accessorKey: "id", header: t('id') },
    { accessorKey: "name", header: t('name') },
    {
      accessorKey: "color",
      header: t('color'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded border border-border"
            style={{ backgroundColor: row.original.color }}
          />
          <span className="text-sm font-mono">{row.original.color}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: t('actions'),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingChallengeDifficulty(row.original)}>
            {t('edit')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(row.original)}>
            {t('delete')}
          </Button>
        </div>
      ),
    },
  ]

  const handleCreate = async (data: ChallengeDifficultyFormData) => {
    await axios.post("/api/challenge-difficulties", data)
    setCreating(false)
    onRefresh()
  }

  const handleUpdate = async (data: ChallengeDifficultyFormData) => {
    if (!editingChallengeDifficulty) return
    await axios.put(`/api/challenge-difficulties/${editingChallengeDifficulty.id}`, data)
    setEditingChallengeDifficulty(null)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!deleting) return
    await axios.delete(`/api/challenge-difficulties/${deleting.id}`)
    setDeleting(null)
    onRefresh()
  }

  const doDeleteSelected = async () => {
    const ids = Object.keys(rowSelection).map((key) => challengeDifficulties[Number.parseInt(key, 10)].id)
    await Promise.all(ids.map((id) => axios.delete(`/api/challenge-difficulties/${id}`)))
    setRowSelection({})
    onRefresh()
    setConfirmMassDelete(false)
  }

  return (
    <>
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t('challenge_difficulty.challenge_difficulties')}</h2>
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
                {t('delete_selected')}
              </Button>
            </div>
            <Sheet open={creating} onOpenChange={setCreating}>
              <SheetTrigger asChild>
                <Button size="sm">{t('challenge_difficulty.new_challenge_difficulty')}</Button>
              </SheetTrigger>
              <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()}>
                <SheetHeader>
                  <SheetTitle>{t('challenge_difficulty.create_challenge_difficulty')}</SheetTitle>
                </SheetHeader>
                <ChallengeDifficultiesForm onSubmit={handleCreate} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={challengeDifficulties}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          equalizeColumnWidths
        />
      </div>
      <Sheet open={!!editingChallengeDifficulty} onOpenChange={(o) => !o && setEditingChallengeDifficulty(null)}>
        <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{t('challenge_difficulty.edit_challenge_difficulty')}</SheetTitle>
          </SheetHeader>
          {editingChallengeDifficulty && (
            <ChallengeDifficultiesForm
              isEdit
              initialData={{ name: editingChallengeDifficulty.name, color: editingChallengeDifficulty.color }}
              onSubmit={handleUpdate}
            />
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('challenge_difficulty.delete_challenge_difficulty')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('challenge_difficulty.delete_challenge_difficulty_confirm', { name: deleting?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmMassDelete} onOpenChange={setConfirmMassDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('challenge_difficulty.delete_challenge_difficulties')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('challenge_difficulty.delete_challenge_difficulties_confirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteSelected}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
