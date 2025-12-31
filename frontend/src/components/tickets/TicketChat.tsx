import { useState, useRef, useEffect } from "react";
import { TicketDetail, TicketMessage, TicketMessageInput } from "@/models/Ticket";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { Send, Paperclip, Shield, User, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadTicketAttachment } from "@/hooks/use-tickets";
import axios from "@/lib/axios";

interface TicketChatProps {
  ticket: TicketDetail;
  isAdmin?: boolean;
  onSendMessage: (input: TicketMessageInput) => Promise<void>;
  onResolve?: () => Promise<void>;
  onClose?: () => Promise<void>;
}

export function TicketChat({
  ticket,
  isAdmin = false,
  onSendMessage,
  onResolve,
  onClose,
}: TicketChatProps) {
  const { t } = useLanguage();
  const { loggedIn } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [ticket.messages]);

  const handleSendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;
    
    setSending(true);
    try {
      await onSendMessage({
        message: message.trim() || '',
        attachments,
      });
      setMessage("");
      setAttachments([]);
      toast.success(t("tickets.message_sent") || "Message sent");
    } catch (error) {
      toast.error(t("tickets.message_failed") || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("tickets.invalid_file_type") || "Only images are allowed");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("tickets.file_too_large") || "File must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      const path = await uploadTicketAttachment(file);
      setAttachments(prev => [...prev, path]);
      toast.success(t("tickets.file_uploaded") || "File uploaded");
    } catch (error) {
      toast.error(t("tickets.upload_failed") || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const isResolved = ticket.status === 'resolved';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                <span className="text-muted-foreground text-sm">#{ticket.id}</span>
              </div>
              <CardTitle className="text-xl">{ticket.subject}</CardTitle>
            </div>
            {isAdmin && ticket.status !== 'resolved' && onResolve && (
              <Button size="sm" variant="default" onClick={onResolve}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {t("tickets.resolve") || "Resolve"}
              </Button>
            )}
            {!isAdmin && ticket.status !== 'resolved' && onClose && (
              <Button size="sm" variant="outline" onClick={onClose}>
                {t("tickets.close") || "Close Ticket"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{ticket.description}</p>
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium mb-2">{t("tickets.attachments") || "Attachments"}:</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.attachments.map((path, idx) => (
                    <a
                      key={idx}
                      href={`/api/tickets/${ticket.id}/attachments/${path.split('/').pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors border"
                    >
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{path.split('/').pop()}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ticket.username}
              </span>
              {ticket.teamName && (
                <span className="flex items-center gap-1">
                  <Badge variant="outline">{ticket.teamName}</Badge>
                </span>
              )}
              {ticket.challengeName && (
                <span className="flex items-center gap-1">
                  <Badge variant="secondary">{ticket.challengeName}</Badge>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(ticket.createdAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <div className="flex-1 overflow-y-scroll space-y-4 mb-4 px-2">
        {ticket.messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {t("tickets.no_messages") || "No messages yet. Start the conversation!"}
          </div>
        ) : (
          ticket.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwnMessage={msg.userId === currentUserId}
              formatDate={formatDate}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isResolved && (
        <div className="border-t pt-4 flex-shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("tickets.type_message") || "Type a message..."}
                className="min-h-[80px] resize-none pr-12"
                disabled={sending}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute bottom-2 right-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={sending || (message.trim().length === 0 && attachments.length === 0)}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {attachments.length > 0 && (
            <div className="flex gap-2 mt-2">
              {attachments.map((path, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  📎 {path.split('/').pop()}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {isResolved && (
        <div className="border-t pt-4 text-center text-muted-foreground">
          {t("tickets.resolved_message") || "This ticket has been resolved."}
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: TicketMessage;
  isOwnMessage: boolean;
  formatDate: (date: string) => string;
}

function MessageBubble({ message, isOwnMessage, formatDate }: MessageBubbleProps) {
  return (
    <div className={cn("flex gap-3", isOwnMessage ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          message.isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          {message.isAdmin ? (
            <Shield className="h-4 w-4" />
          ) : (
            message.username.charAt(0).toUpperCase()
          )}
        </AvatarFallback>
      </Avatar>
      <div className={cn(
        "max-w-[70%] space-y-1",
        isOwnMessage ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="font-medium">
            {message.username}
            {message.isAdmin && (
              <Badge variant="outline" className="ml-1 text-[10px] py-0">Admin</Badge>
            )}
          </span>
          <span>{formatDate(message.createdAt)}</span>
        </div>
        <div className={cn(
          "rounded-lg px-4 py-2",
          isOwnMessage 
            ? "bg-primary text-primary-foreground" 
            : message.isAdmin 
              ? "bg-blue-500/10 border border-blue-500/20" 
              : "bg-muted"
        )}>
          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((path, idx) => (
                <a
                  key={idx}
                  href={`/api/tickets/${message.ticketId}/attachments/${path.split('/').pop()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs underline opacity-80 hover:opacity-100"
                >
                  📎 {path.split('/').pop()}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
