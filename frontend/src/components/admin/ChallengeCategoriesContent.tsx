import { useState } from "react"
import axios from "@/lib/axios";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
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
import ChallengeCategoriesForm from "./ChallengeCategoriesForm"
import { ChallengeCategory, ChallengeCategoryFormData } from "@/models/ChallengeCategory"
import { useLanguage } from "@/context/LanguageContext"

interface ChallengeCategoriesContentProps {
  challengeCategories: ChallengeCategory[]
  onRefresh: () => void
}

export default function ChallengeCategoriesContent({ challengeCategories, onRefresh }: ChallengeCategoriesContentProps) {
  const { t } = useLanguage();
  const [editingChallengeCategory, setEditingChallengeCategory] = useState<ChallengeCategory | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ChallengeCategory | null>(null)
  const [confirmMassDelete, setConfirmMassDelete] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns: ColumnDef<ChallengeCategory>[] = [
    { accessorKey: "id", header: t('id') },
    { accessorKey: "name", header: t('name') },
    {
      id: "actions",
      header: t('actions'),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingChallengeCategory(row.original)}>
            {t('edit')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(row.original)}>
            {t('delete')}
          </Button>
        </div>
      ),
    },
  ]

  const handleCreate = async (data: ChallengeCategoryFormData) => {
    await axios.post("/api/challenge-categories", data)
    setCreating(false)
    onRefresh()
  }

  const handleUpdate = async (data: ChallengeCategoryFormData) => {
    if (!editingChallengeCategory) return
    await axios.put(`/api/challenge-categories/${editingChallengeCategory.id}`, data)
    setEditingChallengeCategory(null)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!deleting) return
    await axios.delete(`/api/challenge-categories/${deleting.id}`)
    setDeleting(null)
    onRefresh()
  }

  const doDeleteSelected = async () => {
    const ids = Object.keys(rowSelection).map((key) => challengeCategories[Number.parseInt(key, 10)].id)
    await Promise.all(ids.map((id) => axios.delete(`/api/challenge-categories/${id}`)))
    setRowSelection({})
    onRefresh()
    setConfirmMassDelete(false)
  }

  return (
    <>
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t('challenge_categories')}</h2>
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
                <Button size="sm">{t('new_challenge_category')}</Button>
              </SheetTrigger>
              <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()}>
                <SheetHeader>
                  <SheetTitle>{t('create_challenge_category')}</SheetTitle>
                </SheetHeader>
                <ChallengeCategoriesForm onSubmit={handleCreate} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={challengeCategories}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          equalizeColumnWidths
        />
      </div>
      <Sheet open={!!editingChallengeCategory} onOpenChange={(o) => !o && setEditingChallengeCategory(null)}>
        <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{t('edit_challenge_category')}</SheetTitle>
          </SheetHeader>
          {editingChallengeCategory && (
            <ChallengeCategoriesForm
              isEdit
              initialData={{ name: editingChallengeCategory.name }}
              onSubmit={handleUpdate}
            />
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_challenge_category')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_challenge_category_confirm', { name: deleting?.name || '' })}
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
            <AlertDialogTitle>{t('delete_challenge_categories')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_challenge_categories_confirm')}
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

