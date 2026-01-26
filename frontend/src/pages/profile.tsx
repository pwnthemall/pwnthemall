import { useProtectedRoute } from "@/hooks/use-protected-route";
import ProductionProfileCard from "@/components/profile/ProductionProfileCard";
import { Loader } from "lucide-react";

export default function ProfilePage() {
  const { loading, loggedIn } = useProtectedRoute();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!loggedIn) return null;

  return <ProductionProfileCard />;
}
