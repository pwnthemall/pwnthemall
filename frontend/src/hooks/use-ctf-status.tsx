import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '@/lib/axios';
import { useRealtimeUpdates } from './use-realtime-updates';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

export interface CTFStatus {
  status: 'not_started' | 'active' | 'ended' | 'no_timing';
  is_active: boolean;
  is_started: boolean;
  startTime?: string;  // RFC3339 datetime string
  endTime?: string;    // RFC3339 datetime string
  serverTime?: string; // RFC3339 datetime string for clock drift correction
}

let activeToastId: string | number | undefined;
let lastStatusChange: string | null = null;
let isFetching = false;
let fetchPromise: Promise<void> | null = null;

export function useCTFStatus() {
  const { loggedIn } = useAuth();
  const { t } = useLanguage();
  const [ctfStatus, setCTFStatus] = useState<CTFStatus>({
    status: 'no_timing',
    is_active: true,
    is_started: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  const tRef = useRef(t);

  // Keep translation function up to date
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchCTFStatus = useCallback(async () => {
    // If already fetching, return the existing promise
    if (isFetching && fetchPromise) {
      return fetchPromise;
    }

    isFetching = true;
    fetchPromise = (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get<CTFStatus>('/api/ctf-status');
        const newStatus = response.data;
      
        // Check if status changed from active to ended or not_started
        const statusChangeKey = `${previousStatusRef.current}->${newStatus.status}`;
        if (previousStatusRef.current && previousStatusRef.current !== newStatus.status && lastStatusChange !== statusChangeKey) {
          console.log(`CTF status changed from ${previousStatusRef.current} to ${newStatus.status}`);
          lastStatusChange = statusChangeKey;
          
          // Dismiss previous toast if exists
          if (activeToastId) {
            toast.dismiss(activeToastId);
            activeToastId = undefined;
          }
          
          // Show persistent toast for ended or not_started status
          if (newStatus.status === 'ended') {
            activeToastId = toast.error(tRef.current('ctf_status_ended_desc'), {
              duration: Infinity,
              className: 'bg-red-600 text-white',
            });
          } else if (newStatus.status === 'not_started') {
            activeToastId = toast.info(tRef.current('ctf_not_started_message'), {
              duration: Infinity,
            });
          } else if (newStatus.status === 'active' || newStatus.status === 'no_timing') {
            // CTF became active - show temporary "back online" toast if coming from ended/not_started
            if (previousStatusRef.current === 'ended' || previousStatusRef.current === 'not_started') {
              toast.success(tRef.current('ctf_status_active_desc'), {
                duration: 5000,
              });
            }
          }
        }
        
        previousStatusRef.current = newStatus.status;
        setCTFStatus(newStatus);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch CTF status');
        // Default to allowing access if we can't determine status
        setCTFStatus({
          status: 'no_timing',
          is_active: true,
          is_started: true,
        });
      } finally {
        setLoading(false);
        isFetching = false;
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCTFStatus();
  }, [fetchCTFStatus]);

  // Listen for real-time updates via WebSocket
  useRealtimeUpdates((event) => {
    if (event.event === 'ctf-status') {
      console.log('CTF status update received, refreshing status...');
      fetchCTFStatus();
    }
  }, loggedIn);

  return {
    ctfStatus,
    loading,
    error,
    refreshStatus: fetchCTFStatus,
  };
}
