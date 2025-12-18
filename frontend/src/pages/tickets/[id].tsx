import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTicketDetail } from "@/hooks/use-tickets";
import { TicketChat } from "@/components/tickets/TicketChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { loading: authLoading, loggedIn } = useProtectedRoute();
  const { getSiteName, siteConfig, loading: configLoading } = useSiteConfig();
  const { t } = useLanguage();
  
  const {
    ticket,
    loading,
    error,
    sendMessage,
    refreshTicket,
  } = useTicketDetail(id as string, false);

  // Check if tickets are disabled and redirect to home
  if (!configLoading && siteConfig.TICKETS_ENABLED === 'false') {
    router.replace('/');
    return null;
  }

  if (authLoading || configLoading || loading) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back button skeleton */}
          <div className="mb-4">
            <Skeleton className="h-9 w-36" />
          </div>
          {/* Chat Card Skeleton */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-5 w-8" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-2/3 mt-2" />
              <div className="flex items-center gap-4 mt-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Messages skeleton */}
              <div className="h-[400px] p-4 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[70%] ${i % 2 === 0 ? '' : 'items-end'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-64' : 'w-48'} rounded-lg`} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Input skeleton */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Skeleton className="h-20 flex-1" />
                  <Skeleton className="h-10 w-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!loggedIn) return null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("tickets.error") || "Error"}</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.push('/tickets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("tickets.back_to_tickets") || "Back to Tickets"}
          </Button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("tickets.not_found") || "Ticket Not Found"}</h2>
          <Button onClick={() => router.push('/tickets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("tickets.back_to_tickets") || "Back to Tickets"}
          </Button>
        </div>
      </div>
    );
  }

  const handleClose = async () => {
    try {
      const response = await fetch(`/api/tickets/${id}/close`, { method: 'PUT' });
      if (response.ok) {
        toast.success(t("tickets.closed_success") || "Ticket closed");
        await refreshTicket();
      }
    } catch (error) {
      toast.error(t("tickets.close_failed") || "Failed to close ticket");
    }
  };

  return (
    <>
      <Head>
        <title>#{ticket.id} {ticket.subject} - {getSiteName()}</title>
      </Head>
      
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back button */}
          <div className="mb-4">
            <Link href="/tickets">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("tickets.back_to_tickets") || "Back to Tickets"}
              </Button>
            </Link>
          </div>

          {/* Chat */}
          <TicketChat
            ticket={ticket}
            isAdmin={false}
            onSendMessage={sendMessage}
            onClose={handleClose}
          />
        </div>
      </div>
    </>
  );
}
