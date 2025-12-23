/**
 * Custom hook for managing challenge actions (select, submit, instance control)
 * Extracted from CategoryContent.tsx to improve maintainability and testability
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Challenge, Solve } from '@/models/Challenge';
import { buildSubmitPayload } from '@/components/pwn/category-helpers';

interface UseChallengeActionsProps {
  currentUser?: any;
  onChallengeUpdate?: () => void;
  stopInstance: (challengeId: string) => Promise<any>;
  startInstance: (challengeId: string) => Promise<any>;
  fetchInstanceStatus: (challengeId: string) => Promise<any>;
  refreshTeamScore?: () => void;
  t: (key: string, params?: any) => string;
}

interface ChallengeActionsResult {
  // State
  selectedChallenge: Challenge | null;
  flag: string;
  geoCoords: {lat: number; lng: number} | null;
  loading: boolean;
  solves: Solve[];
  solvesLoading: boolean;
  open: boolean;
  activeTab: string;
  instanceStatus: Record<number, 'running' | 'stopped' | 'building' | 'expired' | 'stopping'>;
  connectionInfo: Record<number, any[]>;
  instanceOwner: Record<number, { userId: number; username: string }>;
  
  // Setters
  setSelectedChallenge: (challenge: Challenge | null) => void;
  setFlag: (flag: string) => void;
  setGeoCoords: (coords: {lat: number; lng: number} | null) => void;
  setOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setInstanceStatus: React.Dispatch<React.SetStateAction<Record<number, 'running' | 'stopped' | 'building' | 'expired' | 'stopping'>>>;
  setConnectionInfo: React.Dispatch<React.SetStateAction<Record<number, any[]>>>;
  setInstanceOwner: React.Dispatch<React.SetStateAction<Record<number, { userId: number; username: string }>>>;
  
  // Actions
  handleChallengeSelect: (challenge: Challenge) => void;
  handleSubmit: () => Promise<void>;
  handleStartInstance: (challengeId: number) => Promise<void>;
  handleStopInstance: (challengeId: number) => Promise<void>;
  fetchSolves: (challengeId: number) => Promise<void>;
  isInstanceChallenge: (challenge: Challenge) => boolean;
  getLocalInstanceStatus: (challengeId: number) => 'running' | 'stopped' | 'building' | 'expired' | 'stopping';
}

export const useChallengeActions = ({
  currentUser,
  onChallengeUpdate,
  stopInstance,
  startInstance,
  fetchInstanceStatus,
  refreshTeamScore,
  t,
}: UseChallengeActionsProps): ChallengeActionsResult => {
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [flag, setFlag] = useState('');
  const [geoCoords, setGeoCoords] = useState<{lat: number; lng: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [solvesLoading, setSolvesLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [instanceStatus, setInstanceStatus] = useState<Record<number, 'running' | 'stopped' | 'building' | 'expired' | 'stopping'>>({});
  const [connectionInfo, setConnectionInfo] = useState<Record<number, any[]>>({});
  const [instanceOwner, setInstanceOwner] = useState<Record<number, { userId: number; username: string }>>({});

  // Handle challenge submission
  const handleSubmit = useCallback(async () => {
    if (!selectedChallenge) return;
    setLoading(true);
    try {
      const payload = buildSubmitPayload(selectedChallenge, flag, geoCoords);
      const res = await axios.post(`/api/challenges/${selectedChallenge.id}/submit`, payload);

      toast.success(t(res.data.message) || 'Challenge solved!');
      
      fetchSolves(selectedChallenge.id);
      await handlePostSubmitInstanceCleanup(selectedChallenge.id);
      
      // Close the modal after successful submission
      setOpen(false);
      
      // Update challenges after modal is closed to prevent reopening
      if (onChallengeUpdate) {
        setTimeout(() => onChallengeUpdate(), 100);
      }
    } catch (err: any) {
      const errorKey = err.response?.data?.error || err.response?.data?.result;
      toast.error(t(errorKey) || 'Try again');
      if (onChallengeUpdate) onChallengeUpdate();
    } finally {
      setLoading(false);
      setFlag("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChallenge, flag, geoCoords, onChallengeUpdate, t]);

  // Cleanup instance after successful submission
  const handlePostSubmitInstanceCleanup = useCallback(async (challengeId: number) => {
    try {
      if (instanceStatus[challengeId] === 'running') {
        await stopInstance(challengeId.toString());
        setInstanceStatus(prev => ({ ...prev, [challengeId]: 'stopped' }));
        toast.success(t('instance_stopped_success') || 'Instance stopped successfully');
      }
    } catch {}
  }, [instanceStatus, stopInstance, t]);

  // Fetch challenge solves
  const fetchSolves = useCallback(async (challengeId: number) => {
    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      console.error('Invalid challenge ID provided to fetchSolves');
      setSolves([]);
      setSolvesLoading(false);
      return;
    }
    
    setSolvesLoading(true);
    try {
      const response = await axios.get<Solve[]>(`/api/challenges/${challengeId}/solves`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      setSolves(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch solves:', err);
      setSolves([]);
    } finally {
      setSolvesLoading(false);
    }
  }, []);

  // Handle challenge selection
  const handleChallengeSelect = useCallback((challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setFlag("");
    setOpen(true);
    setActiveTab("description");
    // Clear previous solves data and fetch fresh data
    setSolves([]);
    setSolvesLoading(false);
    fetchSolves(challenge.id);
    // Refresh team score when opening challenge
    if (refreshTeamScore) refreshTeamScore();
  }, [fetchSolves, refreshTeamScore]);

  // Start challenge instance
  const handleStartInstance = useCallback(async (challengeId: number) => {
    try {
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'building' }));
      await startInstance(challengeId.toString());
      // Fetch the actual status from backend after starting
      const status = await fetchInstanceStatus(challengeId.toString());
      if (status) {
        let localStatus: 'running' | 'stopped' | 'building' | 'expired' = 'running';
        if (status.status === 'running') {
          localStatus = 'running';
        } else if (status.status === 'building') {
          localStatus = 'building';
        } else if (status.status === 'expired') {
          localStatus = 'expired';
        } else {
          localStatus = 'stopped';
        }
        setInstanceStatus(prev => ({ ...prev, [challengeId]: localStatus }));

        // Store connection info if available
        if (status.connection_info && status.connection_info.length > 0) {
          setConnectionInfo(prev => ({
            ...prev,
            [challengeId]: status.connection_info
          }));
        } else {
          setConnectionInfo(prev => ({
            ...prev,
            [challengeId]: []
          }));
        }
      } else {
        setInstanceStatus(prev => ({ ...prev, [challengeId]: 'running' }));
      }
    } catch (error) {
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'stopped' }));
    }
  }, [startInstance, fetchInstanceStatus]);

  // Stop challenge instance
  const handleStopInstance = useCallback(async (challengeId: number) => {
    try {
      // If we know the owner and it's not the current user (and not admin), show localized toast and abort
      const owner = instanceOwner[challengeId];
      if (owner && currentUser && owner.userId !== currentUser.id && currentUser.role !== 'admin') {
        const ownerName = owner.username || t('a_teammate');
        const key = 'cannot_stop_instance_not_owner';
        const translated = t(key, { username: ownerName });
        toast.error(translated !== key ? translated : `You can't stop this instance because it was started by ${ownerName}.`);
        return;
      }

      // Set status to 'stopping' to show stopping state
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'stopping' }));
      
      await stopInstance(challengeId.toString());
      
      // The status will be updated to 'stopped' via websocket when backend finishes stopping
      // No polling needed - websocket 'instance_update' event will handle it
    } catch (error: any) {
      // If backend denies or not found while we think it's running, assume non-owner attempt
      const errCode = error?.response?.data?.error;
      if (
        (errCode === 'not_authorized' || errCode === 'forbidden' || errCode === 'instance_not_found') &&
        instanceStatus[challengeId] === 'running'
      ) {
        const owner = instanceOwner[challengeId];
        const ownerName = owner?.username || t('a_teammate');
        const key = 'cannot_stop_instance_not_owner';
        const translated = t(key, { username: ownerName });
        toast.error(translated !== key ? translated : `You can't stop this instance because it was started by ${ownerName}.`);
      }
      // Keep current status on error otherwise
    }
  }, [instanceOwner, currentUser, instanceStatus, stopInstance, t]);

  // Check if challenge has instances
  const isInstanceChallenge = useCallback((challenge: Challenge) => {
    const instFlag = challenge.challengeType?.instance;
    if (typeof instFlag === 'boolean') return instFlag;
    
    // fallback to legacy name-based detection
    const name = challenge.challengeType?.name?.toLowerCase() || '';
    return name === 'docker' || name === 'compose';
  }, []);

  // Get local instance status
  const getLocalInstanceStatus = useCallback((challengeId: number) => {
    return instanceStatus[challengeId] || 'stopped';
  }, [instanceStatus]);

  return {
    // State
    selectedChallenge,
    flag,
    geoCoords,
    loading,
    solves,
    solvesLoading,
    open,
    activeTab,
    instanceStatus,
    connectionInfo,
    instanceOwner,
    
    // Setters
    setSelectedChallenge,
    setFlag,
    setGeoCoords,
    setOpen,
    setActiveTab,
    setInstanceStatus,
    setConnectionInfo,
    setInstanceOwner,
    
    // Actions
    handleChallengeSelect,
    handleSubmit,
    handleStartInstance,
    handleStopInstance,
    fetchSolves,
    isInstanceChallenge,
    getLocalInstanceStatus,
  };
};
