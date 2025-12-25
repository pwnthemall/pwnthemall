import Head from "next/head";
import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import axios from "@/lib/axios";
import { toast } from "sonner";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Plus, X, ExternalLink, Edit, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Page } from "@/models/Page";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";

interface PagesContentProps {
  pages: Page[];
  onRefresh: () => void;
  loading: boolean;
}

export default function PagesContent({ pages, onRefresh, loading }: PagesContentProps) {
  const { t, isLoaded } = useLanguage();
  const { getSiteName } = useSiteConfig();
  const router = useRouter();

  const [deleting, setDeleting] = useState<Page | null>(null);
  const [slugFilter, setSlugFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "updated_at">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Handle sort toggle
  const handleSort = (field: "created_at" | "updated_at") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Delete page
  const handleDelete = async () => {
    if (!deleting) return;

    try {
      await axios.delete(`/api/admin/pages/${deleting.id}`);
      toast.success(t("page_deleted_success") || "Page deleted successfully!");
      onRefresh();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to delete page";
      toast.error(errorMsg);
    } finally {
      setDeleting(null);
    }
  };

  // Navigate to edit page
  const handleEdit = (page: Page) => {
    router.push(`/admin/pages/${page.id}/edit`);
  };

  // Navigate to create new page
  const handleCreate = () => {
    router.push("/admin/pages/new");
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Define table columns
  const columns: ColumnDef<Page>[] = [
    {
      accessorKey: "slug",
      header: () => (
        <div className="font-semibold">{t("slug") || "Slug"}</div>
      ),
      cell: ({ getValue, row }) => {
        const slug = getValue() as string;
        return (
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
              /{slug}
            </code>
            <a
              href={`/pages/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title={t("view_page") || "View page"}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: "title",
      header: () => (
        <div className="font-semibold">{t("title") || "Title"}</div>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("created_at")}
        >
          {t("created_at") || "Created"}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: "updated_at",
      header: () => (
        <Button
          variant="ghost"
          className="h-auto p-0 font-semibold hover:bg-transparent"
          onClick={() => handleSort("updated_at")}
        >
          {t("updated_at") || "Updated"}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(getValue() as string)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => (
        <div className="font-semibold">{t("actions") || "Actions"}</div>
      ),
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(row.original)}
          >
            <Edit className="h-4 w-4 mr-1" />
            {t("edit") || "Edit"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("delete") || "Delete"}
          </Button>
        </div>
      ),
    },
  ];

  // Filter and sort pages
  const filteredPages = useMemo(() => {
    let filtered = pages.filter((page) => {
      const slugMatch = page.slug.toLowerCase().includes(slugFilter.toLowerCase());
      const titleMatch = page.title.toLowerCase().includes(titleFilter.toLowerCase());
      return slugMatch && titleMatch;
    });

    // Sort
    filtered.sort((a, b) => {
      const aValue = new Date(a[sortField]).getTime();
      const bValue = new Date(b[sortField]).getTime();
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [pages, slugFilter, titleFilter, sortField, sortDirection]);

  if (!isLoaded) return null;

  return (
    <>
      <Head>
        <title>{t("pages") || "Pages"} - {getSiteName()}</title>
      </Head>

      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("pages") || "Pages"}</h1>
            <p className="text-muted-foreground mt-1">
              {t("pages_description") || "Manage custom HTML pages"}
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("create_page") || "Create Page"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end bg-card p-4 rounded-lg border">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("slug") || "Slug"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_slug") || "Filter by slug..."}
                value={slugFilter}
                onChange={(e) => setSlugFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {slugFilter && (
                <button
                  onClick={() => setSlugFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">
              {t("title") || "Title"}
            </label>
            <div className="relative">
              <Input
                placeholder={t("filter_by_title") || "Filter by title..."}
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value)}
                className="pr-8 bg-background"
              />
              {titleFilter && (
                <button
                  onClick={() => setTitleFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {(slugFilter || titleFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSlugFilter("");
                setTitleFilter("");
              }}
              className="mb-0.5"
            >
              {t("clear_all") || "Clear All"}
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border">
          <DataTable columns={columns} data={filteredPages} />
        </div>

        {/* Empty state */}
        {!loading && filteredPages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {pages.length === 0
              ? t("no_pages_yet") || "No pages created yet. Click 'Create Page' to get started."
              : t("no_pages_match_filter") || "No pages match your filters."}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("delete_page") || "Delete Page"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_page_confirm") || `Are you sure you want to delete the page`}{" "}
              <code className="font-mono font-semibold">/{deleting?.slug}</code>?
              <br />
              {t("delete_page_warning") || "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
