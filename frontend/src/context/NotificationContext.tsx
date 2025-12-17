import React, { createContext, useContext, ReactNode, useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { Notification } from '@/models/Notification';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import { debugLog } from '../lib/debug';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  sendNotification: (notification: any) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  showToastNotification: (notification: Notification) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { loggedIn, authChecked } = useAuth();
  const router = useRouter();
  const [recentlySentNotifications, setRecentlySentNotifications] = useState<Map<string, number>>(new Map());
  
  const {
    notifications,
    unreadCount,
    isConnected,
    sendNotification: originalSendNotification,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications(loggedIn && authChecked);

  // Wrapper for sendNotification that tracks recently sent notifications
  const sendNotification = async (notification: any) => {
    const result = await originalSendNotification(notification);
    
    // Add a temporary flag to prevent showing toast for this notification
    // We'll use a timestamp-based approach to identify recently sent notifications
    const timestamp = Date.now();
    setRecentlySentNotifications(prev => {
      const newMap = new Map(prev);
      newMap.set(timestamp.toString(), timestamp);
      return newMap;
    });
    
    // Remove the flag after 10 seconds
    setTimeout(() => {
      setRecentlySentNotifications(prev => {
        const newMap = new Map(prev);
        newMap.delete(timestamp.toString());
        return newMap;
      });
    }, 10000);
    
    return result;
  };

  // Show toast notification when a new notification is received
  const showToastNotification = (notification: Notification) => {
    // Check if this notification was recently sent by the current user
    // We'll use a simple heuristic: if the notification was created very recently (within 5 seconds)
    // and we have recently sent notifications, don't show the toast
    const notificationTime = new Date(notification.createdAt).getTime();
    const currentTime = Date.now();
    const timeDiff = currentTime - notificationTime;
    
    // Create a key for this notification type to track recent shows
    const recentKey = `${notification.type}_${notification.title}`;
    const now = Date.now();
    
    // Check if we've recently shown this type of notification
    const lastShown = recentlySentNotifications.get(recentKey);
    if (lastShown) {
      const timeSinceLastShow = now - lastShown;
      if (timeSinceLastShow < 5000) { // 5 seconds
        debugLog('Skipping toast for recently sent notification:', notification);
        return;
      }
    }
    
    // Update recent notifications
    setRecentlySentNotifications(prev => {
      const newMap = new Map(prev);
      newMap.set(recentKey, now);
      
      // Clean up old entries (older than 10 seconds)
      Array.from(newMap.entries()).forEach(([key, timestamp]) => {
        if (now - timestamp > 10000) {
          newMap.delete(key);
        }
      });
      
      return newMap;
    });
    
    debugLog('Showing toast notification:', notification);
    
    // Get the appropriate icon based on notification type
    const getIcon = (type: string) => {
      switch (type) {
        case 'error':
          return <XCircle className="w-4 h-4" />;
        case 'warning':
          return <AlertTriangle className="w-4 h-4" />;
        default:
          return <Info className="w-4 h-4" />;
      }
    };

    // Show toast notification using Sonner
    const toastOptions = {
      icon: getIcon(notification.type),
      className: `notification-toast notification-${notification.type}`,
      duration: 6000, // 6 seconds
    };

    switch (notification.type) {
      case 'error':
        toast.error(notification.title, {
          ...toastOptions,
          description: notification.message,
        });
        break;
      case 'warning':
        toast.warning(notification.title, {
          ...toastOptions,
          description: notification.message,
        });
        break;
      default:
        toast.info(notification.title, {
          ...toastOptions,
          description: notification.message,
        });
        break;
    }
  };

  // Listen for new notification events from WebSocket
  React.useEffect(() => {
    const handleNewNotification = (event: CustomEvent<Notification>) => {
      showToastNotification(event.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('new-notification', handleNewNotification as EventListener);
      return () => {
        window.removeEventListener('new-notification', handleNewNotification as EventListener);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isConnected,
    sendNotification,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    showToastNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}; 