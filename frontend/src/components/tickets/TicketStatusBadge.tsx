import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface TicketStatusBadgeProps {
  status: 'open' | 'resolved';
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const { t } = useLanguage();
  
  const statusConfig = {
    open: {
      label: t('tickets.open') || 'Open',
      variant: 'default' as const,
      className: 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/50',
    },
    resolved: {
      label: t('tickets.resolved') || 'Resolved',
      variant: 'default' as const,
      className: 'bg-green-500/20 text-green-500 hover:bg-green-500/30 border-green-500/50',
    },
  };

  const config = statusConfig[status] || statusConfig.open;

  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
