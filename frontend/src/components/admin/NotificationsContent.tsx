import Head from "next/head";
import { useState } from "react";
import { useNotificationContext } from "@/context/NotificationContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { SentNotification, NotificationInput } from "@/models/Notification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Trash2, Send, Users, User, CheckCircle } from "lucide-react";
import axios from "@/lib/axios";
import { TeamSelector } from "./TeamSelector";
import { UserSelector } from "./UserSelector";

interface NotificationsContentProps {
  notifications: SentNotification[];
  onRefresh: () => void;
}

export default function NotificationsContent({ 
  notifications, 
  onRefresh 
}: NotificationsContentProps) {
  const { t } = useLanguage();
  const { getSiteName } = useSiteConfig();
  const { sendNotification } = useNotificationContext();
  
  const [formData, setFormData] = useState<NotificationInput>({
    title: "",
    message: "",
    type: "info",
  });
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const [targetType, setTargetType] = useState<'everyone' | 'team' | 'user'>('everyone');
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error(t("please_fill_fields"));
      return;
    }

    if (targetType === 'team' && !selectedTeamId) {
      toast.error(t("please_select_team"));
      return;
    }

    if (targetType === 'user' && !selectedUserId) {
      toast.error(t("please_select_user"));
      return;
    }

    // Prepare notification data based on target type
    const notificationData = {
      ...formData,
      userId: targetType === 'user' ? selectedUserId : undefined,
      teamId: targetType === 'team' ? selectedTeamId : undefined,
    };

    setIsSending(true);
    try {
      await sendNotification(notificationData);
      toast.success(t("notification_sent_success"), {
        icon: <CheckCircle className="w-4 h-4" />,
        className: "success-toast",
      });
      setFormData({ title: "", message: "", type: "info" });
      setSelectedTeamId(undefined);
      setSelectedUserId(undefined);
      setTargetType('everyone');
      onRefresh();
    } catch (error) {
      toast.error(t("notification_sent_error"));
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(id);
    try {
      await axios.delete(`/api/admin/notifications/${id}`);
      toast.success(t("notification_deleted_success"), {
        icon: <CheckCircle className="w-4 h-4" />,
        className: "success-toast",
      });
      onRefresh();
    } catch (error) {
      toast.error(t("notification_deleted_error"));
    } finally {
      setIsDeleting(null);
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
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <Head>
        <title>{getSiteName()} - Admin Notifications</title>
      </Head>
      
      <div className="min-h-screen p-6 overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("notifications")}</h1>
            <p className="text-foreground">
              {t("notifications_description")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {t("send_notification")}
              </CardTitle>
              <CardDescription className="text-foreground">
                {t("send_notification_description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("notification_title")}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t("notification_title")}
                    maxLength={255}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t("notification_message")}</Label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t("notification_message")}
                    rows={4}
                    required
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">{t("notification_type")}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'info' | 'warning' | 'error') => 
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t("info")}</SelectItem>
                      <SelectItem value="warning">{t("warning")}</SelectItem>
                      <SelectItem value="error">{t("error")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("target_audience")}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={targetType === 'everyone' ? 'default' : 'outline'}
                      onClick={() => setTargetType('everyone')}
                      className="flex-1"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {t("everyone")}
                    </Button>
                    <Button
                      type="button"
                      variant={targetType === 'team' ? 'default' : 'outline'}
                      onClick={() => setTargetType('team')}
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t("team")}
                    </Button>
                    <Button
                      type="button"
                      variant={targetType === 'user' ? 'default' : 'outline'}
                      onClick={() => setTargetType('user')}
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t("user")}
                    </Button>
                  </div>
                  
                  {/* Team selector - only show when team target is selected */}
                  {targetType === 'team' && (
                    <div className="mt-4">
                      <TeamSelector
                        selectedTeamId={selectedTeamId}
                        onTeamSelect={setSelectedTeamId}
                        disabled={isSending}
                      />
                    </div>
                  )}

                  {/* User selector - only show when user target is selected */}
                  {targetType === 'user' && (
                    <div className="mt-4">
                      <UserSelector
                        selectedUserId={selectedUserId}
                        onUserSelect={setSelectedUserId}
                        disabled={isSending}
                      />
                    </div>
                  )}
                  
                  <p className="text-sm text-foreground">
                    {targetType === 'everyone' && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {t("send_to_all_users")}
                      </span>
                    )}
                    {targetType === 'team' && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedTeamId ? t("send_to_team") : t("select_team_placeholder")}
                      </span>
                    )}
                    {targetType === 'user' && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedUserId ? t("send_to_specific_user") : t("select_user_placeholder")}
                      </span>
                    )}
                  </p>
                </div>

                <Button type="submit" disabled={isSending} className="w-full">
                  {isSending ? t("submitting") : t("send_notification")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Sent Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle>{t("sent_notifications")}</CardTitle>
              <CardDescription className="text-foreground">
                {t("sent_notifications_description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {!notifications || notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {t("no_notifications_sent")}
                  </p>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{notification.title}</h4>
                            <Badge variant={getTypeColor(notification.type)}>
                              {t(notification.type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{formatDate(notification.createdAt)}</span>
                            {notification.username ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {notification.username}
                              </span>
                            ) : notification.teamName ? (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {notification.teamName}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {t("all_users")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                          disabled={isDeleting === notification.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Separator />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
} 