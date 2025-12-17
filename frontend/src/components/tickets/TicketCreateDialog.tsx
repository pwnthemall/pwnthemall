import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { TicketInput } from "@/models/Ticket";
import { Challenge } from "@/models/Challenge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, User, Users, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "@/lib/axios";
import { uploadTicketAttachment } from "@/hooks/use-tickets";

interface UserData {
  id: number;
  teamId?: number;
}

interface TicketCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: TicketInput) => Promise<void>;
}

export function TicketCreateDialog({
  open,
  onOpenChange,
  onSubmit,
}: TicketCreateDialogProps) {
  const { t } = useLanguage();
  const { loggedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userData, setUserData] = useState<UserData | null>(null);
  const [ticketType, setTicketType] = useState<'user' | 'team'>('user');
  const [isChallengeRelated, setIsChallengeRelated] = useState(false);
  const [challengeId, setChallengeId] = useState<number | undefined>();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch user data
  useEffect(() => {
    if (loggedIn && open) {
      axios.get("/api/me").then((res) => {
        setUserData({ id: res.data.id, teamId: res.data.team_id });
      }).catch(() => {});
    }
  }, [loggedIn, open]);

  const hasTeam = !!userData?.teamId;

  // Fetch challenges when dialog opens
  useEffect(() => {
    if (open && isChallengeRelated) {
      fetchChallenges();
    }
  }, [open, isChallengeRelated]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTicketType('user');
      setIsChallengeRelated(false);
      setChallengeId(undefined);
      setSubject("");
      setDescription("");
      setAttachments([]);
    }
  }, [open]);

  const fetchChallenges = async () => {
    try {
      const response = await axios.get<Challenge[]>('/api/challenges');
      setChallenges(response.data || []);
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
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

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error(t("tickets.subject_required") || "Subject is required");
      return;
    }
    if (!description.trim()) {
      toast.error(t("tickets.description_required") || "Description is required");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        subject: subject.trim(),
        description: description.trim(),
        ticketType,
        teamId: ticketType === 'team' ? userData?.teamId : undefined,
        challengeId: isChallengeRelated ? challengeId : undefined,
        attachments,
      });
      toast.success(t("tickets.created_success") || "Ticket created successfully");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t("tickets.create_failed") || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tickets.create_ticket") || "Create Support Ticket"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Ticket Type */}
          <div className="space-y-3">
            <Label>{t("tickets.ticket_type") || "Ticket Type"}</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={ticketType === 'user' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTicketType('user')}
              >
                <User className="h-4 w-4 mr-2" />
                {t("tickets.personal") || "Personal"}
              </Button>
              <Button
                type="button"
                variant={ticketType === 'team' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTicketType('team')}
                disabled={!hasTeam}
              >
                <Users className="h-4 w-4 mr-2" />
                {t("tickets.team") || "Team"}
              </Button>
            </div>
            {!hasTeam && ticketType === 'user' && (
              <p className="text-xs text-muted-foreground">
                {t("tickets.no_team_hint") || "You're not in a team. Team tickets are disabled."}
              </p>
            )}
          </div>

          {/* Challenge Related */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="challenge-related" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                {t("tickets.challenge_related") || "Related to a challenge?"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("tickets.challenge_related_hint") || "Select if this is about a specific challenge"}
              </p>
            </div>
            <Switch
              id="challenge-related"
              checked={isChallengeRelated}
              onCheckedChange={setIsChallengeRelated}
            />
          </div>

          {/* Challenge Selector */}
          {isChallengeRelated && (
            <div className="space-y-2">
              <Label>{t("tickets.select_challenge") || "Select Challenge"}</Label>
              <Select
                value={challengeId?.toString()}
                onValueChange={(value) => setChallengeId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("tickets.select_challenge_placeholder") || "Select a challenge..."} />
                </SelectTrigger>
                <SelectContent>
                  {challenges.map((challenge) => (
                    <SelectItem key={challenge.id} value={challenge.id.toString()}>
                      {challenge.name}
                      {challenge.challengeCategory && (
                        <span className="text-muted-foreground ml-2">
                          ({challenge.challengeCategory.name})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">{t("tickets.subject") || "Subject"}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("tickets.subject_placeholder") || "Brief description of your issue"}
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("tickets.description") || "Description"}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tickets.description_placeholder") || "Describe your issue in detail..."}
              className="min-h-[120px]"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>{t("tickets.attachments") || "Attachments"}</Label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((path, idx) => (
                <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                  📎 {path.split('/').pop()}
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Paperclip className="h-4 w-4 mr-1" />
                {uploading ? (t("tickets.uploading") || "Uploading...") : (t("tickets.add_image") || "Add Image")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("tickets.attachment_hint") || "Images only (JPEG, PNG, GIF, WebP). Max 10MB."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (t("tickets.creating") || "Creating...") : (t("tickets.create") || "Create Ticket")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
