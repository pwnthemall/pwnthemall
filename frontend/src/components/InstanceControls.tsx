import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Trash2, Clock } from 'lucide-react';
import { useInstances } from '@/hooks/use-instances';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { debugLog, debugError } from '../lib/debug';

interface InstanceControlsProps {
  challengeId: number;
  onStatusChange?: () => void;
}

interface InstanceStatus {
  has_instance: boolean;
  status: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
  name: string;
}

export const InstanceControls: React.FC<InstanceControlsProps> = ({ 
  challengeId, 
  onStatusChange 
}) => {
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const { t } = useLanguage();
  const { 
    loading: instanceLoading, 
    startInstance, 
    stopInstance, 
    killInstance, 
    getInstanceStatus 
  } = useInstances();

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getInstanceStatus(challengeId.toString());
      setInstanceStatus(status);
    } catch (error) {
      debugError('Failed to fetch instance status:', error);
    }
  }, [challengeId, getInstanceStatus]);

  useEffect(() => {
    fetchStatus();
    // Poll for status updates every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    // Also react instantly to websocket instance updates for this challenge
    const handler = (e: any) => {
      try {
        const data = e?.detail ?? (typeof e?.data === 'string' ? JSON.parse(e.data) : e?.data);
        if (data?.event === 'instance_update') {
          const cid = Number(data.challengeId);
          if (cid === challengeId) {
            // If instance was stopped, clear the stopping state
            if (data.status === 'stopped') {
              setIsStopping(false);
            }
            fetchStatus();
          }
        }
      } catch {}
    };
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.addEventListener('instance-update', handler as EventListener);
    }
    return () => {
      clearInterval(interval);
      if (typeof globalThis.window !== 'undefined') {
        globalThis.window.removeEventListener('instance-update', handler as EventListener);
      }
    };
  }, [fetchStatus]);

  const handleStartInstance = async () => {
    setLoading(true);
    try {
      await startInstance(challengeId.toString());
      await fetchStatus();
      onStatusChange?.();
    } catch (error: any) {
      debugError('Failed to start instance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopInstance = async () => {
    setLoading(true);
    setIsStopping(true);
    try {
      debugLog(`InstanceControls: Stopping instance for challenge ${challengeId}`);
      await stopInstance(challengeId.toString());
      debugLog('InstanceControls: Instance stopped successfully, fetching updated status');
      await fetchStatus();
      onStatusChange?.();
    } catch (error: any) {
      debugError('InstanceControls: Failed to stop instance:', error);
    } finally {
      setLoading(false);
      setIsStopping(false);
    }
  };

  const handleKillInstance = async () => {
    setLoading(true);
    try {
      debugLog(`InstanceControls: Killing instance for challenge ${challengeId}`);
      await killInstance(challengeId.toString());
      debugLog('InstanceControls: Instance killed successfully, fetching updated status');
      await fetchStatus();
      onStatusChange?.();
    } catch (error: any) {
      debugError('InstanceControls: Failed to kill instance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!instanceStatus?.has_instance) {
      return (
        <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-700">
          {t('no_instance') || 'No Instance'}
        </Badge>
      );
    }

    const status = instanceStatus.status;
    const isExpired = instanceStatus.is_expired;

    if (isExpired) {
      return (
        <Badge variant="secondary" className="bg-red-300 dark:bg-red-700 text-red-900 dark:text-red-100">
          {t('expired') || 'Expired'}
        </Badge>
      );
    }

    // Show "Stopping" state when user clicked stop button
    if (isStopping) {
      return (
        <Badge variant="secondary" className="bg-orange-300 dark:bg-orange-700 text-orange-900 dark:text-orange-100">
          {t('stopping') || 'Stopping...'}
        </Badge>
      );
    }

    switch (status) {
      case 'running':
        return (
          <Badge variant="secondary" className="bg-green-300 dark:bg-green-700 text-green-900 dark:text-green-100">
            {t('running') || 'Running'}
          </Badge>
        );
      case 'stopped':
        return (
          <Badge variant="secondary" className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            {t('stopped') || 'Stopped'}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-orange-300 dark:bg-orange-700 text-orange-900 dark:text-orange-100">
            {status}
          </Badge>
        );
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Unknown';
    try {
      return new Date(timeString).toLocaleString();
    } catch (error) {
      return 'Invalid time';
    }
  };

  const getTimeRemaining = () => {
    if (!instanceStatus?.expires_at) return null;
    
    const expiresAt = new Date(instanceStatus.expires_at);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m remaining`;
    }
    return `${remainingMinutes}m remaining`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          {instanceStatus?.has_instance && instanceStatus.expires_at && (
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{getTimeRemaining()}</span>
            </div>
          )}
        </div>
      </div>

      {instanceStatus?.has_instance && (
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Container: {instanceStatus.name}</div>
          <div>Created: {formatTime(instanceStatus.created_at)}</div>
          {instanceStatus.expires_at && (
            <div>Expires: {formatTime(instanceStatus.expires_at)}</div>
          )}
        </div>
      )}

      <div className="flex space-x-2">
        {!instanceStatus?.has_instance && (
          <Button
            onClick={handleStartInstance}
            disabled={loading || instanceLoading}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          >
            <Play className="w-4 h-4 mr-2" />
            {t('start_instance') || 'Start Instance'}
          </Button>
        )}

        {instanceStatus?.has_instance && instanceStatus.status === 'running' && (
          <>
            <Button
              onClick={handleStopInstance}
              disabled={loading || instanceLoading}
              variant="outline"
            >
              <Square className="w-4 h-4 mr-2" />
              {t('stop_instance') || 'Stop Instance'}
            </Button>
            {/* <Button
              onClick={handleKillInstance}
              disabled={loading || instanceLoading}
              variant="destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('kill_instance') || 'Kill Instance'}
            </Button> */}
          </>
        )}

        {instanceStatus?.has_instance && (instanceStatus.status === 'stopped' || instanceStatus.status == 'expired') && (
          <Button
            onClick={handleStartInstance}
            disabled={loading || instanceLoading}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          >
            <Play className="w-4 h-4 mr-2" />
            {t('restart_instance') || 'Restart Instance'}
          </Button>
        )}
      </div>
    </div>
  );
}; 