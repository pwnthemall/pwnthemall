import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "@/lib/axios";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import PageEditor from "@/components/admin/PageEditor";
import { PageFormData } from "@/models/Page";

export default function EditPagePage() {
  const { loading, isAdmin } = useAdminAuth();
  const router = useRouter();
  const { id } = router.query;

  const [pageData, setPageData] = useState<PageFormData | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !id) return;

    const fetchPage = async () => {
      try {
        setFetchLoading(true);
        const response = await axios.get(`/api/admin/pages/${id}`);
        const { page, html } = response.data;
        
        setPageData({
          slug: page.slug,
          title: page.title,
          html: html,
        });
      } catch (err: any) {
        console.error("Failed to fetch page:", err);
        setError(err.response?.data?.error || "Failed to load page");
      } finally {
        setFetchLoading(false);
      }
    };

    fetchPage();
  }, [isAdmin, id]);

  if (loading || !isAdmin) return null;
  
  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Page not found"}</p>
          <button
            onClick={() => router.push("/admin/pages")}
            className="text-primary hover:underline"
          >
            Back to Pages
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageEditor 
      mode="edit" 
      pageId={Number(id)} 
      initialData={pageData}
    />
  );
}
