import React from 'react';
import { Bell } from 'lucide-react';
import { useNotificationContext } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
  className 
}) => {
  const { unreadCount, isConnected } = useNotificationContext();

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center",
        className
      )}
    >
      <Bell className="h-4 w-4" />
      
      {/* Unread indicator - only show red circle when there are unread notifications */}
      {unreadCount > 0 && (
        <div 
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"
          title={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        />
      )}
    </div>
  );
}; 