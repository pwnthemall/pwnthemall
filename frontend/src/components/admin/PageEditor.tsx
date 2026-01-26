import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { EditorView, basicSetup } from "codemirror";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import debounce from "lodash.debounce";
import { toast } from "sonner";
import axios from "@/lib/axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { PageFormData } from "@/models/Page";
import { useLanguage } from "@/context/LanguageContext";

interface PageEditorProps {
  initialData?: PageFormData;
  pageId?: number;
  mode: "create" | "edit";
}

export default function PageEditor({ initialData, pageId, mode }: PageEditorProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const [slug, setSlug] = useState(initialData?.slug || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [htmlContent, setHtmlContent] = useState(initialData?.html || "");
  const [previewContent, setPreviewContent] = useState(initialData?.html || "");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Debounced preview update
  const debouncedPreviewUpdate = useMemo(
    () => debounce((content: string) => {
      setPreviewContent(content);
    }, 500),
    []
  );

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      doc: initialData?.html || "",
      extensions: [
        basicSetup,
        html(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            setHtmlContent(content);
            debouncedPreviewUpdate(content);
            setIsDirty(true);
          }
        }),
      ],
      parent: editorRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      debouncedPreviewUpdate.cancel();
    };
  }, []);


  // Handle save (create or update)
  const handleSave = useCallback(async () => {
    // Validation
    if (!slug.trim()) {
      toast.error(t("slug_required") || "Slug is required");
      return;
    }
    if (!title.trim()) {
      toast.error(t("title_required") || "Title is required");
      return;
    }
    if (!htmlContent.trim()) {
      toast.error(t("html_required") || "HTML content is required");
      return;
    }
    
    // File size validation (max 1MB)
    const sizeInBytes = new Blob([htmlContent]).size;
    const maxSizeInBytes = 1024 * 1024; // 1MB
    if (sizeInBytes > maxSizeInBytes) {
      toast.error(t("html_too_large") || "HTML content is too large (max 1MB)");
      return;
    }

    setSaving(true);

    try {
      const payload: PageFormData = {
        slug: slug.trim(),
        title: title.trim(),
        html: htmlContent,
      };

      if (mode === "create") {
        await axios.post("/api/admin/pages", payload);
        toast.success(t("page_created_success") || "Page created successfully!");
      } else {
        await axios.put(`/api/admin/pages/${pageId}`, payload);
        toast.success(t("page_updated_success") || "Page updated successfully!");
      }

      setIsDirty(false);
      router.push("/admin/pages");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to save page";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  }, [slug, title, htmlContent, mode, pageId, t, router]);

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    // Keyboard shortcut: Ctrl+S / Cmd+S to save
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !saving) {
          handleSave();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDirty, saving, handleSave]);


  // Handle cancel
  const handleCancel = () => {
    if (isDirty) {
      if (!confirm(t("unsaved_changes_warning") || "You have unsaved changes. Are you sure you want to leave?")) {
        return;
      }
    }
    router.push("/admin/pages");
  };

  // Validate slug format as user types
  const isValidSlug = (value: string) => {
    return /^[a-z0-9-]*$/.test(value);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    if (isValidSlug(value) || value === "") {
      setSlug(value);
      setIsDirty(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("back_to_pages") || "Back to Pages"}
          </Button>
          <h1 className="text-2xl font-bold">
            {mode === "create"
              ? t("create_page") || "Create Page"
              : t("edit_page") || "Edit Page"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("saving") || "Saving..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t("save_page") || "Save Page"}
            </>
          )}
        </Button>
      </div>

      {/* Form inputs */}
      <div className="border-b bg-card px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="slug" className="mb-2 block">
            {t("slug") || "Slug"} <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <Input
              id="slug"
              value={slug}
              onChange={handleSlugChange}
              placeholder="about"
              aria-label="Page URL slug"
              className="flex-1"
            />
          </div>
          {slug && (
            <p className="text-sm text-muted-foreground mt-1">
              {t("page_will_be_available_at") || "Will be available at:"}{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">
                /pages/{slug}
              </code>
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="title" className="mb-2 block">
            {t("title") || "Title"} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
            }}
            placeholder="About Us"
            aria-label="Page title"
          />
        </div>
      </div>

      {/* Editor and Preview (split view) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col border-r">
          <div className="border-b bg-muted/50 px-4 py-2 font-semibold text-sm">
            {t("html_editor") || "HTML/CSS Editor"}
          </div>
          <div 
            ref={editorRef} 
            className="flex-1 overflow-auto"
            role="textbox"
            aria-label="HTML code editor"
          />
        </div>

        {/* Live Preview */}
        <div className="flex-1 flex flex-col">
          <div className="border-b bg-muted/50 px-4 py-2 font-semibold text-sm flex items-center justify-between">
            <span>{t("live_preview") || "Live Preview"}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {t("preview_updates_automatically") || "Updates as you type"}
            </span>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <iframe
              srcDoc={previewContent}
              sandbox=""
              title="Page preview"
              className="w-full h-full border-0"
              style={{ background: 'white' }}
            />
          </div>
        </div>
      </div>

      {/* Footer help text */}
      <div className="border-t bg-muted px-6 py-2 text-sm text-muted-foreground">
        {t("page_editor_help") || "Tip: Only HTML and CSS are allowed. JavaScript will be removed for security."}
        {" • "}
        <kbd className="px-1 py-0.5 text-xs bg-muted-foreground/20 rounded">Ctrl+S</kbd>
        {" or "}
        <kbd className="px-1 py-0.5 text-xs bg-muted-foreground/20 rounded">⌘S</kbd>
        {" to save"}
        {isDirty && <span className="ml-4 text-orange-600 font-semibold">● {t("unsaved_changes") || "Unsaved changes"}</span>}
      </div>
    </div>
  );
}
