export interface TeamChatMessage {
  id: number;
  teamId: number;
  userId: number;
  username: string;
  message: string;
  attachments: string[];
  createdAt: string;
}

export interface TeamChatMessageInput {
  message: string;
  attachments?: string[];
}

export interface TeamChatMessagesResponse {
  messages: TeamChatMessage[];
  hasMore: boolean;
  nextCursor?: number;
  totalMessages: number;
}
