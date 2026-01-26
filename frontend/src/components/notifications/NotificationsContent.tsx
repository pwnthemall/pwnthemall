import React, { useState, useEffect } from 'react';
import { useNotificationContext } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, CheckCheck, Bell, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification } from '@/models/Notification';

export default function NotificationsContent() {
  const { t } = useLanguage();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    refreshNotifications,
    isConnected 
  } = useNotificationContext();
  
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const unreadNotifications = notifications.filter(n => !n.readAt);
  const readNotifications = notifications.filter(n => n.readAt);

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "error":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "default";
    }
  };



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes === 0 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderNotification = (notification: Notification) => (
    <div
      key={notification.id}
      role="button"
      tabIndex={0}
      className={cn(
        "p-4 hover:bg-muted/50 transition-colors cursor-pointer border-l-4",
        !notification.readAt && "bg-muted/30 border-l-primary",
        notification.readAt && "border-l-transparent"
      )}
      onClick={() => !notification.readAt && markAsRead(notification.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !notification.readAt) {
          e.preventDefault();
          markAsRead(notification.id);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">
                            {notification.title}
                          </h4>
                          <Badge variant={getTypeColor(notification.type)} className="text-xs">
                            {notification.type}
                          </Badge>
                          {!notification.readAt && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                          )}
                        </div>
          <p className="text-sm text-muted-foreground mb-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(notification.createdAt)}</span>
            {notification.readAt && (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('read')}
              </span>
            )}
          </div>
        </div>
      </div>
      <Separator className="mt-3" />
    </div>
  );

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12 text-muted-foreground">
      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium mb-2">{message}</p>
      <p className="text-sm">{t('no_notifications_yet')}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{t('notifications')}</h1>
              <p className="text-muted-foreground">
                {t('manage_your_notifications')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAll}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                {t('mark_all_read')}
              </Button>
            )}
          </div>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm">
          <div 
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )}
          />
          <span className="text-muted-foreground">
            {isConnected ? t('connected') : t('disconnected')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card border rounded-lg p-1">
          <TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">
            {t('all')}
            <Badge variant="secondary" className="ml-1">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">
            {t('unread')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">
            {t('read')}
            <Badge variant="secondary" className="ml-1">
              {readNotifications.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t('all_notifications')}
              </CardTitle>
              <CardDescription>
                {notifications.length === 0 
                  ? t('no_notifications_yet')
                  : `${notifications.length} ${t('notification')}${notifications.length === 1 ? '' : 's'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                renderEmptyState(t('no_notifications_yet'))
              ) : (
                <div className="divide-y">
                  {notifications.map(renderNotification)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t('unread_notifications')}
              </CardTitle>
              <CardDescription>
                {unreadCount === 0 
                  ? t('all_caught_up')
                  : `${unreadCount} ${t('unread_notification')}${unreadCount === 1 ? '' : 's'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {unreadNotifications.length === 0 ? (
                renderEmptyState(t('all_caught_up'))
              ) : (
                <div className="divide-y">
                  {unreadNotifications.map(renderNotification)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="read" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t('read_notifications')}
              </CardTitle>
              <CardDescription>
                {readNotifications.length === 0 
                  ? t('no_read_notifications')
                  : `${readNotifications.length} ${t('read_notification')}${readNotifications.length === 1 ? '' : 's'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {readNotifications.length === 0 ? (
                renderEmptyState(t('no_read_notifications'))
              ) : (
                <div className="divide-y">
                  {readNotifications.map(renderNotification)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 