import Head from "next/head";
import { useEffect, useState } from "react";
import axios from "@/lib/axios";

import { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import ConfigurationForm from "./ConfigurationForm";
import CTFStatusOverview from "./CTFStatusOverview";
import { Config, ConfigFormData } from "@/models/Config";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { toast } from "sonner";

interface ConfigurationContentProps {
  configs: Config[];
  onRefresh: () => void;
}

export default function ConfigurationContent({ configs, onRefresh }: ConfigurationContentProps) {
  const { t, isLoaded } = useLanguage();
  const { getSiteName, refreshConfig } = useSiteConfig();
  const [editingConfig, setEditingConfig] = useState<Config | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Config | null>(null);
  const [confirmMassDelete, setConfirmMassDelete] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [createError, setCreateError] = useState<string | null>(null);

  const columns: ColumnDef<Config>[] = [
    {
      accessorKey: "key",
      header: t("key"),
      cell: ({ getValue }) => (
        <span className="block min-w-[150px] max-w-[250px] truncate font-mono text-sm">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "value",
      header: t("value"),
      cell: ({ getValue, row }) => {
        const value = getValue() as string;
        const key = row.original.key;
        
        // Mask sensitive fields (passwords, secrets, tokens)
        const excludedKeys = ['PASSWORD_RESET'];
        const sensitiveKeywords = ['PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'CREDENTIAL'];
        const isSensitive = !excludedKeys.includes(key) && 
                           sensitiveKeywords.some(keyword => key.toUpperCase().includes(keyword));
        
        if (isSensitive && value) {
          return (
            <div className="min-w-[200px] max-w-[300px]">
              <span className="font-mono text-sm text-muted-foreground">••••••••</span>
              <div className="text-xs text-muted-foreground mt-1">
                {t("encrypted_value")}
              </div>
            </div>
          );
        }
        
        // Special formatting for CTF timing configurations
        if ((key === "CTF_START_TIME" || key === "CTF_END_TIME") && value) {
          try {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
              return (
                <div className="min-w-[200px] max-w-[300px]">
                  <div className="font-mono text-sm">{date.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {key === "CTF_START_TIME" ? t("competition_started") : t("competition_ended")}
                  </div>
                </div>
              );
            }
          } catch {
            // Fall through to default display
          }
        }
        
        // Special display for empty CTF timing values
        if ((key === "CTF_START_TIME" || key === "CTF_END_TIME") && !value) {
          return (
            <div className="min-w-[200px] max-w-[300px]">
              <span className="text-muted-foreground italic">{t("not_configured")}</span>
              <div className="text-xs text-muted-foreground mt-1">
                {key === "CTF_START_TIME" ? t("no_start_time_limit") : t("no_end_time_limit")}
              </div>
            </div>
          );
        }
        
        return (
          <span className="block min-w-[200px] max-w-[300px] truncate font-mono text-sm">
            {value}
          </span>
        );
      },
    },
    {
      accessorKey: "public",
      header: t("public"),
      cell: ({ getValue }) => {
        const isPublic = getValue() as boolean;
        return (
          <span className={cn("font-semibold", isPublic ? "text-green-600" : "text-red-600")}>
            {isPublic ? t("yes") : t("no")}
          </span>
        );
      },
    },
    {
      accessorKey: "syncWithEnv",
      header: t("syncWithEnv"),
      cell: ({ getValue }) => {
        const syncWithEnv = getValue() as boolean;
        return (
          <span className={cn("font-semibold", syncWithEnv ? "text-green-600" : "text-red-600")}>
            {syncWithEnv ? t("yes") : t("no")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex gap-2 whitespace-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingConfig(row.original)}
          >
            {t("edit")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleting(row.original)}
          >
            {t("delete")}
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = async (data: ConfigFormData) => {
    setCreateError(null);
    try {
      const isCTFTimingConfig = data.key === "CTF_START_TIME" || data.key === "CTF_END_TIME";
      
      await axios.post("/api/configs", data);
      setCreating(false);
      
      // Show toast first
      toast.success(t("config_created_success"));
      
      // Refresh site config if this is a public config
      if (data.public) {
        refreshConfig();
      }
      
      // Refresh the page immediately if this was a CTF timing configuration
      if (isCTFTimingConfig) {
        window.location.reload();
      } else {
        onRefresh();
      }
    } catch (err: any) {
      let msg = err?.response?.data?.error || t("config_create_failed");
      
      if (!isLoaded) {
        setCreateError(t("config_create_failed"));
        return;
      }
      
      setCreateError(msg);
    }
  };

  const handleUpdate = async (data: ConfigFormData) => {
    if (!editingConfig) return;
    const isCTFTimingConfig = editingConfig.key === "CTF_START_TIME" || editingConfig.key === "CTF_END_TIME";
    
    await axios.put(`/api/configs/${editingConfig.key}`, data);
    setEditingConfig(null);
    
    // Show toast first
    toast.success(t("config_updated_success"));
    
    // Refresh site config if this is a public config
    if (data.public) {
      refreshConfig();
    }
    
    // Refresh the page immediately if this was a CTF timing configuration
    if (isCTFTimingConfig) {
      window.location.reload();
    } else {
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const wasPublic = deleting.public;
    await axios.delete(`/api/configs/${deleting.key}`);
    setDeleting(null);
    toast.success(t("config_deleted_success"));
    onRefresh();
    // Refresh site config if this was a public config
    if (wasPublic) {
      refreshConfig();
    }
  };

  const doDeleteSelected = async () => {
    const keys = Object.keys(rowSelection).map((key) => configs[Number.parseInt(key, 10)].key);
    await Promise.all(keys.map((key) => axios.delete(`/api/configs/${key}`)));
    setRowSelection({});
    setConfirmMassDelete(false);
    toast.success(t("configs_deleted_success"));
    onRefresh();
  };

  // Sort configs to prioritize CTF timing configurations
  const sortedConfigs = [...configs].sort((a, b) => {
    const ctfConfigOrder = ["CTF_START_TIME", "CTF_END_TIME"];
    const aIndex = ctfConfigOrder.indexOf(a.key);
    const bIndex = ctfConfigOrder.indexOf(b.key);
    
    // If both are CTF configs, sort by the defined order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // CTF configs come first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // Otherwise, sort alphabetically
    return a.key.localeCompare(b.key, 'en', { sensitivity: 'base' });
  });

  // Filter configs based on PASSWORD_RESET
  const passwordResetEnabled = configs.find(c => c.key === "PASSWORD_RESET")?.value === "true";
  const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
  
  const filteredConfigs = sortedConfigs.filter(config => {
    // If password reset is disabled, hide SMTP-related keys (except the toggle itself)
    if (!passwordResetEnabled && smtpKeys.includes(config.key)) {
      return false;
    }
    return true;
  });

  return (
    <>
      <Head>
        <title>{getSiteName()}</title>
      </Head>
      <div className="min-h-screen p-4 overflow-x-auto">
        {/* CTF Status Overview */}
        <div className="mb-6">
          <CTFStatusOverview />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("configuration")}</h1>
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
            </div>
            <Sheet open={creating} onOpenChange={setCreating}>
              <SheetTrigger asChild>
                <Button size="sm">{t("new_config")}</Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <SheetHeader>
                  <SheetTitle>{t("create_config")}</SheetTitle>
                </SheetHeader>
                <ConfigurationForm onSubmit={handleCreate} apiError={createError} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filteredConfigs}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!editingConfig} onOpenChange={(o) => !o && setEditingConfig(null)}>
        <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{t("edit_config")}</SheetTitle>
          </SheetHeader>
          {editingConfig && (
            <ConfigurationForm
              isEdit
              initialData={{
                key: editingConfig.key,
                value: editingConfig.value,
                public: editingConfig.public,
                syncWithEnv: editingConfig.syncWithEnv,
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
            <AlertDialogTitle>{t("delete_config")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_config_confirm", { key: deleting?.key || "" })}
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

      {/* Confirm Mass Delete */}
      <AlertDialog open={confirmMassDelete} onOpenChange={setConfirmMassDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_configs")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_configs_confirm")}
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
    </>
  );
} 