import { useState, useRef, useEffect } from "react";
import { TeamChatMessage, TeamChatMessageInput } from "@/models/TeamChat";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTeamChat } from "@/hooks/use-team-chat";
import axios from "@/lib/axios";

interface TeamChatProps {
  teamId: number;
  teamName: string;
}

export function TeamChat({ teamId, teamName }: TeamChatProps) {
  const { t } = useLanguage();
  const { loggedIn } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    loading,
    error,
    hasMore,
    sendMessage: sendChatMessage,
    loadMoreMessages,
  } = useTeamChat(teamId);

  // Fetch current user ID
  useEffect(() => {
    if (loggedIn) {
      axios.get("/api/me").then((res) => {
        setCurrentUserId(res.data.id);
      }).catch(() => {});
    }
  }, [loggedIn]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      await sendChatMessage({
        message: message.trim(),
      });
      setMessage("");
      toast.success(t("team.message_sent") || "Message sent");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error;
      if (errorMsg === 'too_many_messages') {
        toast.error(t("team.too_many_messages") || "Too many messages. Please slow down.");
      } else if (errorMsg === 'not_in_team') {
        toast.error(t("team.not_in_team") || "You must be in this team to send messages");
      } else {
        toast.error(t("team.message_failed") || "Failed to send message");
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("time.just_now") || "Just now";
    if (diffMins < 60) return `${diffMins}${t("time.min_ago") || "m ago"}`;
    if (diffHours < 24) return `${diffHours}${t("time.hour_ago") || "h ago"}`;
    if (diffDays < 7) return `${diffDays}${t("time.day_ago") || "d ago"}`;

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  if (error) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {teamName} {t("team.chat") || "Chat"}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("team.no_messages") || "No messages yet. Start the conversation!"}</p>
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("team.load_more") || "Load more messages"
                    )}
                  </Button>
                </div>
              )}
              {messages.map((msg) => {
                const isOwnMessage = msg.userId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      isOwnMessage ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isOwnMessage && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(msg.username)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "flex flex-col max-w-[70%]",
                        isOwnMessage ? "items-end" : "items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {msg.username}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 break-words overflow-wrap-anywhere",
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-all">{msg.message}</p>
                      </div>
                    </div>
                    {isOwnMessage && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {getInitials(msg.username)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("team.type_message") || "Type a message..."}
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={sending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={sending || message.trim().length === 0}
              className="self-end"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("team.chat_hint") || "Press Enter to send, Shift+Enter for new line"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
