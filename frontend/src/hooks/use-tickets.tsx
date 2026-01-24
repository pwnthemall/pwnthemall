import { useEffect, useState, useCallback } from 'react';
import { Ticket, TicketDetail, TicketInput, TicketListResponse, TicketMessage, TicketMessageInput } from '@/models/Ticket';
import axios from '@/lib/axios';
import { debugLog, debugError } from '@/lib/debug';
import { useRealtimeUpdates, UpdateEvent } from './use-realtime-updates';

interface UseTicketsOptions {
  status?: string;
  page?: number;
  pageSize?: number;
  isAdmin?: boolean;
}

interface UseTicketsReturn {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  refreshTickets: () => Promise<void>;
  createTicket: (input: TicketInput) => Promise<Ticket>;
  closeTicket: (id: number) => Promise<void>;
}

export function useTickets(options: UseTicketsOptions = {}): UseTicketsReturn {
  const { status, page = 1, pageSize = 20, isAdmin = false } = options;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isAdmin ? '/api/admin/tickets' : '/api/tickets';
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await axios.get<TicketListResponse>(`${endpoint}?${params.toString()}`);
      setTickets(response.data.tickets || []);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (err: any) {
      debugError('Failed to fetch tickets:', err);
      setError(err.response?.data?.error || 'Failed to fetch tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, pageSize, isAdmin]);

  // Handle real-time updates with partial state updates
  const handleUpdate = useCallback((event: UpdateEvent) => {
    debugLog('Ticket list event received:', event, 'isAdmin:', isAdmin);

    if (event.event === 'ticket_created' && event.ticketId) {
      // Optimistically add the new ticket to the top of the list if on page 1
      if (page === 1) {
        const newTicket: Ticket = {
          id: event.ticketId,
          subject: event.subject || '',
          description: '',
          status: 'open',
          ticketType: event.teamId ? 'team' : 'user',
          userId: event.userId || 0,
          username: event.username,
          teamId: event.teamId,
          messageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attachments: [],
        };
        setTickets(prev => {
          // Avoid duplicates
          if (prev.some(t => t.id === event.ticketId)) {
            return prev;
          }
          // Add to top, remove last if exceeding page size
          const updated = [newTicket, ...prev];
          if (updated.length > pageSize) {
            updated.pop();
          }
          return updated;
        });
        setTotal(prev => prev + 1);
      }
    } else if (event.event === 'ticket_resolved' && event.ticketId) {
      // Update the specific ticket's status in place
      debugLog('Updating ticket status to resolved for ticket:', event.ticketId);
      setTickets(prev => {
        const updated = prev.map(ticket => 
          ticket.id === event.ticketId 
            ? { ...ticket, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
            : ticket
        );
        debugLog('Tickets after update:', updated.filter(t => t.id === event.ticketId));
        return updated;
      });
    } else if (event.event === 'ticket_message' && event.ticketId) {
      // Update message count and last message preview
      setTickets(prev => prev.map(ticket => 
        ticket.id === event.ticketId 
          ? { 
              ...ticket, 
              messageCount: (ticket.messageCount || 0) + 1,
              lastMessage: event.message ? (event.message.length > 100 ? event.message.slice(0, 100) + '...' : event.message) : ticket.lastMessage,
              updatedAt: new Date().toISOString(),
            }
          : ticket
      ));
    }
  }, [page, pageSize, isAdmin]);

  useRealtimeUpdates(handleUpdate, true);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = useCallback(async (input: TicketInput): Promise<Ticket> => {
    const response = await axios.post<Ticket>('/api/tickets', input);
    const newTicket = response.data;
    // Optimistically add to top of list if on page 1
    if (page === 1) {
      setTickets(prev => {
        // Avoid duplicates
        if (prev.some(t => t.id === newTicket.id)) {
          return prev;
        }
        const updated = [newTicket, ...prev];
        if (updated.length > pageSize) {
          updated.pop();
        }
        return updated;
      });
      setTotal(prev => prev + 1);
    }
    return newTicket;
  }, [page, pageSize]);

  const closeTicket = useCallback(async (id: number): Promise<void> => {
    await axios.put(`/api/tickets/${id}/close`);
    // Optimistically update status (WebSocket will also update for other users)
    setTickets(prev => prev.map(ticket =>
      ticket.id === id
        ? { ...ticket, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
        : ticket
    ));
  }, []);

  return {
    tickets,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    refreshTickets: fetchTickets,
    createTicket,
    closeTicket,
  };
}

interface UseTicketDetailReturn {
  ticket: TicketDetail | null;
  loading: boolean;
  error: string | null;
  refreshTicket: () => Promise<void>;
  sendMessage: (input: TicketMessageInput) => Promise<void>;
  closeTicket: () => Promise<void>;
  resolveTicket: () => Promise<void>;
}

export function useTicketDetail(ticketId: number | string, isAdmin: boolean = false): UseTicketDetailReturn {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = isAdmin ? `/api/admin/tickets/${ticketId}` : `/api/tickets/${ticketId}`;
      const response = await axios.get<TicketDetail>(endpoint);
      setTicket(response.data);
    } catch (err: any) {
      debugError('Failed to fetch ticket:', err);
      setError(err.response?.data?.error || 'Failed to fetch ticket');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId, isAdmin]);

  // Handle real-time updates for this specific ticket with partial state updates
  const handleUpdate = useCallback((event: UpdateEvent) => {
    if (event.ticketId !== Number(ticketId)) return;
    
    debugLog('Ticket detail event received:', event);
    
    if (event.event === 'ticket_resolved') {
      // Update status in place
      setTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
    } else if (event.event === 'ticket_message' && event.messageId && event.createdAt) {
      // Append new message directly from WebSocket event data
      const newMessage: TicketMessage = {
        id: event.messageId,
        ticketId: event.ticketId!,
        userId: event.userId!,
        username: event.username || '',
        message: event.message || '',
        isAdmin: event.isAdmin || false,
        attachments: event.attachments || [],
        createdAt: event.createdAt,
      };
      setTicket(prev => {
        if (!prev) return null;
        // Check if message already exists (avoid duplicates)
        if (prev.messages.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return {
          ...prev,
          messages: [...prev.messages, newMessage],
        };
      });
    }
  }, [ticketId]);

  useRealtimeUpdates(handleUpdate, true);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const sendMessage = useCallback(async (input: TicketMessageInput): Promise<void> => {
    const endpoint = isAdmin ? `/api/admin/tickets/${ticketId}/messages` : `/api/tickets/${ticketId}/messages`;
    const response = await axios.post<TicketMessage>(endpoint, input);
    // Immediately add the message to the state (WebSocket will handle other users)
    const newMessage = response.data;
    setTicket(prev => {
      if (!prev) return null;
      if (prev.messages.some(m => m.id === newMessage.id)) {
        return prev;
      }
      return {
        ...prev,
        messages: [...prev.messages, newMessage],
      };
    });
  }, [ticketId, isAdmin]);

  const closeTicket = useCallback(async (): Promise<void> => {
    // Validate ticket ID
    if (!ticketId || !/^\d+$/.test(String(ticketId))) {
      throw new Error('invalid_ticket_id');
    }
    await axios.put(`/api/tickets/${ticketId}/close`);
    // WebSocket will update the state
  }, [ticketId]);

  const resolveTicket = useCallback(async (): Promise<void> => {
    await axios.put(`/api/admin/tickets/${ticketId}/resolve`);
    // WebSocket will update the state
  }, [ticketId]);

  return {
    ticket,
    loading,
    error,
    refreshTicket: fetchTicket,
    sendMessage,
    closeTicket,
    resolveTicket,
  };
}

// Helper function to upload attachment
export async function uploadTicketAttachment(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post<{ path: string }>('/api/tickets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.path;
}
