export interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  ticketType: 'user' | 'team';
  userId: number;
  username?: string;
  teamId?: number;
  teamName?: string;
  challengeId?: number;
  challengeName?: string;
  challengeSlug?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  messageCount: number;
  lastMessage?: string;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  userId: number;
  username: string;
  message: string;
  isAdmin: boolean;
  attachments: string[];
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export interface TicketInput {
  subject: string;
  description: string;
  ticketType: 'user' | 'team';
  teamId?: number;
  challengeId?: number;
  attachments?: string[];
}

export interface TicketMessageInput {
  message: string;
  attachments?: string[];
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
