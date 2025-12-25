import { useEffect, useState } from "react";
import axios from "@/lib/axios";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import PagesContent from "@/components/admin/PagesContent";
import { Page } from "@/models/Page";

export default function AdminPagesPage() {
  const { loading, isAdmin } = useAdminAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  const fetchPages = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get<{ pages: Page[] }>("/api/admin/pages");
      setPages(response.data.pages || []);
    } catch (error) {
      console.error("Failed to fetch pages:", error);
      setPages([]);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPages();
    }
  }, [isAdmin]);

  if (loading || !isAdmin) return null;

  return <PagesContent pages={pages} onRefresh={fetchPages} loading={fetchLoading} />;
}
