import { useState, useEffect } from "react";
import { useInstances } from "./use-instances";
import { Challenge } from "@/models/Challenge";
import { debugError } from "@/lib/debug";

type InstanceStatus = 'running' | 'stopped' | 'building' | 'expired';

interface InstanceOwner {
  userId: number;
  username?: string;
}

interface UseChallengeInstancesResult {
  instanceStatus: { [key: number]: InstanceStatus };
  instanceDetails: { [key: number]: any };
  connectionInfo: { [key: number]: string[] };
  instanceOwner: { [key: number]: InstanceOwner };
  handleStartInstance: (challengeId: number) => Promise<void>;
  handleStopInstance: (challengeId: number, currentUserId?: number, isAdmin?: boolean, onError?: (message: string) => void) => Promise<void>;
  getLocalInstanceStatus: (challengeId: number) => InstanceStatus;
  isInstanceChallenge: (challenge: Challenge) => boolean;
}

export function useChallengeInstances(
  challenges: Challenge[],
  t: (key: string, params?: Record<string, any>) => string
): UseChallengeInstancesResult {
  const [instanceStatus, setInstanceStatus] = useState<{ [key: number]: InstanceStatus }>({});
  const [instanceDetails, setInstanceDetails] = useState<{ [key: number]: any }>({});
  const [connectionInfo, setConnectionInfo] = useState<{ [key: number]: string[] }>({});
  const [instanceOwner, setInstanceOwner] = useState<{ [key: number]: InstanceOwner }>({});
  const [statusFetched, setStatusFetched] = useState(false);

  const { startInstance, stopInstance, getInstanceStatus: fetchInstanceStatus } = useInstances();

  const isInstanceChallenge = (challenge: Challenge) => {
    const typeName = challenge.challengeType?.name?.toLowerCase();
    return typeName === 'docker' || typeName === 'compose';
  };

  const getLocalInstanceStatus = (challengeId: number): InstanceStatus => {
    return instanceStatus[challengeId] || 'stopped';
  };

  const mapApiStatusToLocal = (apiStatus: string): InstanceStatus => {
    if (apiStatus === 'running') return 'running';
    if (apiStatus === 'building') return 'building';
    if (apiStatus === 'expired') return 'expired';
    return 'stopped';
  };

  // Fetch instance status for all Docker challenges when challenges are loaded
  useEffect(() => {
    if (!challenges || challenges.length === 0 || statusFetched) return;

    const fetchAllInstanceStatuses = async () => {
      const dockerChallenges = challenges.filter(isInstanceChallenge);

      for (const challenge of dockerChallenges) {
        try {
          const status = await fetchInstanceStatus(challenge.id.toString());
          if (status) {
            setInstanceStatus(prev => ({
              ...prev,
              [challenge.id]: mapApiStatusToLocal(status.status)
            }));

            setConnectionInfo(prev => ({
              ...prev,
              [challenge.id]: status.connection_info || []
            }));
          }
        } catch (error) {
          debugError(`Failed to fetch status for challenge ${challenge.id}:`, error);
        }
      }
      setStatusFetched(true);
    };

    fetchAllInstanceStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges.length, statusFetched]);

  // Real-time: listen to instance updates over WebSocket
  useEffect(() => {
    const handler = (e: any) => {
      const data = e?.detail || e?.data;
      if (!data || data.event !== 'instance_update') return;

      const challengeId = Number(data.challengeId);
      if (!challengeId) return;

      const newStatus = mapApiStatusToLocal(data.status);

      setInstanceStatus(prev => ({ ...prev, [challengeId]: newStatus }));

      if (newStatus === 'running' && Array.isArray(data.connectionInfo)) {
        setConnectionInfo(prev => ({ ...prev, [challengeId]: data.connectionInfo }));
      } else if (newStatus !== 'running') {
        setConnectionInfo(prev => ({ ...prev, [challengeId]: [] }));
      }

      if (newStatus === 'running' && (typeof data.userId === 'number' || typeof data.userId === 'string')) {
        setInstanceOwner(prev => ({
          ...prev,
          [challengeId]: { userId: Number(data.userId), username: data.username }
        }));
      } else if (newStatus !== 'running') {
        setInstanceOwner(prev => {
          const copy = { ...prev };
          delete copy[challengeId];
          return copy;
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('instance-update', handler as EventListener);
      return () => window.removeEventListener('instance-update', handler as EventListener);
    }
  }, []);

  const handleStartInstance = async (challengeId: number) => {
    try {
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'building' }));
      const response = await startInstance(challengeId.toString());

      // For compose challenges, the backend responds immediately but builds async
      const isComposeStarting = response?.status === 'compose_instance_starting';
      if (isComposeStarting) {
        debugError('Compose instance starting, waiting for WebSocket update');
        return;
      }

      // For regular docker challenges, fetch status immediately
      const status = await fetchInstanceStatus(challengeId.toString());
      if (status) {
        setInstanceStatus((prev: { [key: number]: InstanceStatus }) => ({ ...prev, [challengeId]: mapApiStatusToLocal(status.status) }));
        setConnectionInfo((prev: { [key: number]: string[] }) => ({ ...prev, [challengeId]: status.connection_info || [] }));
      } else {
        setInstanceStatus((prev: { [key: number]: InstanceStatus }) => ({ ...prev, [challengeId]: 'running' }));
      }
    } catch (error) {
      // Only set to stopped if it's a real error
      if ((error as any)?.code !== 'ERR_NETWORK_CHANGED') {
        setInstanceStatus((prev: { [key: number]: InstanceStatus }) => ({ ...prev, [challengeId]: 'stopped' }));
      }
    }
  };

  const handleStopInstance = async (
    challengeId: number,
    currentUserId?: number,
    isAdmin?: boolean,
    onError?: (message: string) => void
  ) => {
    try {
      const owner = instanceOwner[challengeId];
      if (owner && currentUserId && owner.userId !== currentUserId && !isAdmin) {
        const ownerName = owner.username || t('a_teammate');
        const key = 'cannot_stop_instance_not_owner';
        const translated = t(key, { username: ownerName });
        const message = translated !== key ? translated : `You can't stop this instance because it was started by ${ownerName}.`;
        if (onError) onError(message);
        return;
      }

      await stopInstance(challengeId.toString());
      setInstanceStatus((prev: { [key: number]: InstanceStatus }) => ({ ...prev, [challengeId]: 'stopped' }));

      setTimeout(async () => {
        try {
          const status = await fetchInstanceStatus(challengeId.toString());
          if (status) {
            setInstanceStatus((prev: { [key: number]: InstanceStatus }) => ({ ...prev, [challengeId]: mapApiStatusToLocal(status.status) }));
          }
        } catch (error) {
          debugError('Failed to verify status after stopping:', error);
        }
      }, 1000);
    } catch (error: any) {
      const errCode = error?.response?.data?.error;
      if (
        (errCode === 'not_authorized' || errCode === 'forbidden' || errCode === 'instance_not_found') &&
        getLocalInstanceStatus(challengeId) === 'running'
      ) {
        const owner = instanceOwner[challengeId];
        const ownerName = owner?.username || t('a_teammate');
        const key = 'cannot_stop_instance_not_owner';
        const translated = t(key, { username: ownerName });
        const message = translated !== key ? translated : `You can't stop this instance because it was started by ${ownerName}.`;
        if (onError) onError(message);
      }
    }
  };

  return {
    instanceStatus,
    instanceDetails,
    connectionInfo,
    instanceOwner,
    handleStartInstance,
    handleStopInstance,
    getLocalInstanceStatus,
    isInstanceChallenge
  };
}
