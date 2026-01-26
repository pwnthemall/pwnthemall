import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from '@/lib/axios';
import { SidebarPage } from '@/models/Page';
import { useRealtimeUpdates, UpdateEvent } from '@/hooks/use-realtime-updates';

interface SidebarPagesContextType {
  pages: SidebarPage[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

const SidebarPagesContext = createContext<SidebarPagesContextType | undefined>(undefined);

export function SidebarPagesProvider({ children }: { children: React.ReactNode }) {
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPages = useCallback(async () => {
    try {
      setError(false);
      const response = await axios.get<{ pages: SidebarPage[] }>('/api/pages');
      setPages((response.data.pages || []).filter(page => page.is_in_sidebar === true));
    } catch (err) {
      console.error('Failed to fetch sidebar pages:', err);
      setError(true);
      setPages([]); // Reset to empty on error
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchPages();
  }, [fetchPages]);

  // Handle WebSocket updates for sidebar pages
  const handleRealtimeUpdate = useCallback((event: UpdateEvent) => {
    if (event.event === 'sidebar_pages_update') {
      fetchPages();
    }
  }, [fetchPages]);

  // Subscribe to real-time updates
  useRealtimeUpdates(handleRealtimeUpdate, true);

  useEffect(() => {
    fetchPages();

    // Listen for page sync events from WebSocket
    const handlePageSynced = () => {
      fetchPages();
    };

    window.addEventListener('pages:synced', handlePageSynced);
    
    return () => {
      window.removeEventListener('pages:synced', handlePageSynced);
    };
  }, [fetchPages]);

  return (
    <SidebarPagesContext.Provider value={{ pages, loading, error, refetch }}>
      {children}
    </SidebarPagesContext.Provider>
  );
}

export function useSidebarPages() {
  const context = useContext(SidebarPagesContext);
  if (context === undefined) {
    throw new Error('useSidebarPages must be used within a SidebarPagesProvider');
  }
  return context;
}
