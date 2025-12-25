import { useState } from "react";
import Head from "next/head";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTickets, useTicketDetail } from "@/hooks/use-tickets";
import { Ticket } from "@/models/Ticket";
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge";
import { TicketChat } from "@/components/tickets/TicketChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, User, Users } from "lucide-react";
import { toast } from "sonner";

export default function AdminTicketsPage() {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const { getSiteName, siteConfig, loading: configLoading } = useSiteConfig();
  const { t } = useLanguage();
  
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  
  const { tickets, loading } = useTickets({
    status: statusFilter || undefined,
    isAdmin: true,
  });

  // Check if tickets are disabled - show message for admins
  const ticketsDisabled = !configLoading && siteConfig.TICKETS_ENABLED === 'false';

  if (authLoading || configLoading || !isAdmin) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="flex gap-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-36" />
        </div>

        {/* Tickets List Skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show message if tickets are disabled
  if (ticketsDisabled) {
    return (
      <>
        <Head>
          <title>{t('admin.tickets')} - {getSiteName()}</title>
        </Head>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('admin.tickets')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('ticket_system_disabled_admin') || 'The ticket system is currently disabled. Enable it in the configuration page.'}
            </p>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('ticket_system_disabled') || 'Ticket System Disabled'}</h3>
              <p className="text-muted-foreground mb-4">
                {t('ticket_system_disabled_description') || 'The ticket system is currently disabled. You can enable it in the configuration page.'}
              </p>
              <Button onClick={() => window.location.href = '/admin/configuration'}>
                {t('go_to_configuration') || 'Go to Configuration'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("tickets.just_now") || "Just now";
    if (diffMins < 60) return `${diffMins}m ${t("tickets.ago") || "ago"}`;
    if (diffHours < 24) return `${diffHours}h ${t("tickets.ago") || "ago"}`;
    if (diffDays < 7) return `${diffDays}d ${t("tickets.ago") || "ago"}`;
    return date.toLocaleDateString();
  };

  const filteredTickets = tickets.filter(ticket => {
    if (typeFilter && typeFilter !== 'all' && ticket.ticketType !== typeFilter) return false;
    return true;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <>
      <Head>
        <title>{t("admin.tickets") || "Tickets"} - {getSiteName()}</title>
      </Head>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.ticket_management") || "Ticket Management"}</h1>
            <p className="text-muted-foreground">
              {t("admin.ticket_management_desc") || "Manage and respond to support tickets"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {openCount > 0 && (
              <Badge variant="destructive">{openCount} {t("tickets.open") || "open"}</Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1">
            <TabsList>
              <TabsTrigger value="">{t("tickets.all") || "All"}</TabsTrigger>
              <TabsTrigger value="open">{t("tickets.open") || "Open"}</TabsTrigger>
              <TabsTrigger value="resolved">{t("tickets.resolved") || "Resolved"}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t("tickets.type") || "Type"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tickets.all_types") || "All Types"}</SelectItem>
              <SelectItem value="user">{t("tickets.personal") || "Personal"}</SelectItem>
              <SelectItem value="team">{t("tickets.team") || "Team"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t("tickets.no_tickets") || "No tickets"}
              </h3>
              <p className="text-muted-foreground text-center">
                {statusFilter 
                  ? (t("tickets.no_tickets_filter") || "No tickets match your filters.")
                  : (t("tickets.no_tickets_admin") || "No support tickets have been submitted yet.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TicketStatusBadge status={ticket.status} />
                        <span className="text-sm text-muted-foreground">#{ticket.id}</span>
                        {ticket.ticketType === 'team' ? (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {ticket.teamName || (t("tickets.team") || "Team")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <User className="h-3 w-3 mr-1" />
                            {ticket.username}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium truncate">{ticket.subject}</h3>
                      {ticket.lastMessage && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {ticket.lastMessage}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(ticket.updatedAt || ticket.createdAt)}
                        </span>
                        {ticket.messageCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket.messageCount}
                          </span>
                        )}
                        {ticket.challengeName && (
                          <Badge variant="secondary" className="text-xs">
                            {ticket.challengeName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Sheet */}
      <TicketDetailSheet
        ticketId={selectedTicketId}
        onClose={() => {
          setSelectedTicketId(null);
        }}
      />
    </>
  );
}

interface TicketDetailSheetProps {
  ticketId: number | null;
  onClose: () => void;
}

function TicketDetailSheet({ ticketId, onClose }: TicketDetailSheetProps) {
  const { t } = useLanguage();
  const {
    ticket,
    loading,
    sendMessage,
    resolveTicket,
    refreshTicket,
  } = useTicketDetail(ticketId || 0, true);

  const handleResolve = async () => {
    try {
      await resolveTicket();
    } catch (error) {
      toast.error(t("tickets.resolve_failed") || "Failed to resolve ticket");
    }
  };

  return (
    <Sheet open={ticketId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>{t("tickets.ticket_details") || "Ticket Details"}</SheetTitle>
          </div>
        </SheetHeader>

        {loading || !ticket ? (
          <div className="space-y-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-5 w-8" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-2/3" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            {/* Messages skeleton */}
            <div className="space-y-4 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[70%]">
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
            <div className="border-t pt-4">
              <div className="flex gap-2">
                <Skeleton className="h-20 flex-1" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
          </div>
        ) : (
          <TicketChat
            ticket={ticket}
            isAdmin={true}
            onSendMessage={sendMessage}
            onResolve={handleResolve}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
