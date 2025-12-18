/**
 * Custom hook for managing WebSocket events related to challenges
 * Extracted from CategoryContent.tsx to centralize real-time update logic
 */

import { useEffect, useCallback, useRef } from 'react';
import { Challenge } from '@/models/Challenge';

interface WebSocketEvent {
  type: string;
  data: any;
}

interface TeamSolveEvent {
  challengeId: number;
  teamId: number;
  userId: number;
  teamName: string;
}

interface HintPurchaseEvent {
  challengeId: number;
  teamId: number;
  userId: number;
  cost: number;
  hintId: number;
  hintTitle?: string;
  hintContent?: string;
  username?: string;
}

interface InstanceUpdateEvent {
  challengeId: number;
  status: 'building' | 'running' | 'stopped' | 'error';
  connectionInfo?: string | any[];
  userId?: number | string;
  username?: string;
}

interface UseChallengeWebSocketProps {
  socket: any | null;
  selectedChallengeId: number | null;
  currentTeamId?: number;
  onTeamSolve?: (event: TeamSolveEvent) => void;
  onHintPurchase?: (event: HintPurchaseEvent) => void;
  onInstanceUpdate?: (event: InstanceUpdateEvent) => void;
}

export type { HintPurchaseEvent, InstanceUpdateEvent, TeamSolveEvent };

export const useChallengeWebSocket = ({
  socket,
  selectedChallengeId,
  currentTeamId,
  onTeamSolve,
  onHintPurchase,
  onInstanceUpdate,
}: UseChallengeWebSocketProps) => {
  const handlersRef = useRef({ onTeamSolve, onHintPurchase, onInstanceUpdate });

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = { onTeamSolve, onHintPurchase, onInstanceUpdate };
  }, [onTeamSolve, onHintPurchase, onInstanceUpdate]);

  // Handle team solve event
  const handleTeamSolve = useCallback((data: TeamSolveEvent) => {
    console.log('[WebSocket] Team solve event received:', data);
    
    if (handlersRef.current.onTeamSolve) {
      handlersRef.current.onTeamSolve(data);
    }
  }, []);

  // Handle hint purchase event
  const handleHintPurchaseEvent = useCallback((data: HintPurchaseEvent) => {
    console.log('[WebSocket] Hint purchase event received:', data);
    
    // Only trigger callback if it's the current team
    if (data.teamId === currentTeamId && handlersRef.current.onHintPurchase) {
      handlersRef.current.onHintPurchase(data);
    }
  }, [currentTeamId]);

  // Handle instance update event
  const handleInstanceUpdate = useCallback((data: InstanceUpdateEvent) => {
    console.log('[WebSocket] Instance update event received:', data);
    
    // Only trigger callback if it's for the currently selected challenge
    if (data.challengeId === selectedChallengeId && handlersRef.current.onInstanceUpdate) {
      handlersRef.current.onInstanceUpdate(data);
    }
  }, [selectedChallengeId]);

  // Register WebSocket event listeners
  useEffect(() => {
    if (!socket) {
      console.log('[WebSocket] Socket not available');
      return;
    }

    console.log('[WebSocket] Registering challenge event listeners');

    // Register event listeners
    socket.on('team-solve', handleTeamSolve);
    socket.on('hint-purchase', handleHintPurchaseEvent);
    socket.on('instance-update', handleInstanceUpdate);

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Cleaning up challenge event listeners');
      socket.off('team-solve', handleTeamSolve);
      socket.off('hint-purchase', handleHintPurchaseEvent);
      socket.off('instance-update', handleInstanceUpdate);
    };
  }, [socket, handleTeamSolve, handleHintPurchaseEvent, handleInstanceUpdate]);

  return {
    // Expose handlers for manual triggering if needed
    handleTeamSolve,
    handleHintPurchaseEvent,
    handleInstanceUpdate,
  };
};
