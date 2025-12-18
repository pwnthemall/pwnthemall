import { useAdminAuth } from "@/hooks/use-admin-auth";
import PageEditor from "@/components/admin/PageEditor";

export default function NewPagePage() {
  const { loading, isAdmin } = useAdminAuth();

  if (loading || !isAdmin) return null;

  return <PageEditor mode="create" />;
}
