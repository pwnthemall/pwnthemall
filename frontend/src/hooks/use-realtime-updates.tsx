// hooks/use-realtime-updates.tsx
import { useEffect, useRef, useState } from 'react';

export type UpdateEvent = {
  event: 'challenge-category' | 'ctf-status' | 'instance' | 'user-banned' | 'ticket_created' | 'ticket_message' | 'ticket_resolved' | 'config-update' | 'team_message';
  action?: string;
  data?: any;
  key?: string;
  value?: string;
  user_id?: number;
  // Ticket event fields
  ticketId?: number;
  subject?: string;
  userId?: number;
  username?: string;
  teamId?: number;
  message?: string;
  messageId?: number;
  attachments?: string[];
  createdAt?: string;
  isAdmin?: boolean;
};

type UpdateCallback = (event: UpdateEvent) => void;

// Global WebSocket connection and callbacks registry
let globalWs: WebSocket | null = null;
let globalIsConnected = false;
let reconnectTimeout: NodeJS.Timeout | undefined;
let isConnecting = false;
let closeTimeout: NodeJS.Timeout | undefined;
const callbacks = new Map<number, UpdateCallback>();
const connectionListeners = new Set<(connected: boolean) => void>();
let callbackIdCounter = 0;

export function useRealtimeUpdates(onUpdate?: UpdateCallback, enabled: boolean = true, requireAuth: boolean = true) {
  const [isConnected, setIsConnected] = useState(globalIsConnected);
  const callbackIdRef = useRef<number>(0);
  const onUpdateRef = useRef(onUpdate);

  // Keep the callback ref up to date
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<UpdateEvent>;
      
      if (!customEvent.detail || !customEvent.detail.event) {
        console.warn('[useRealtimeUpdates] Invalid event structure');
        return;
      }
      
      const data = customEvent.detail;
      
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[useRealtimeUpdates] Callback error:', error);
        }
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('realtime-update', handleRealtimeUpdate);
    }

    // Assign unique ID for this callback
    const callbackId = ++callbackIdCounter;
    callbackIdRef.current = callbackId;

    // Register this callback with a stable wrapper
    const stableCallback = (event: UpdateEvent) => {
      if (onUpdateRef.current) {
        onUpdateRef.current(event);
      }
    };
    callbacks.set(callbackId, stableCallback);

    // Register connection listener
    const connectionListener = (connected: boolean) => {
      setIsConnected(connected);
    };
    connectionListeners.add(connectionListener);

    // Connect if not already connected or connecting
    if (!globalWs && !isConnecting) {
      isConnecting = true;
      
      const connect = () => {
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}/ws/updates`;

          const ws = new WebSocket(wsUrl);
          globalWs = ws;

          ws.onopen = () => {
            // Silently connect
            globalIsConnected = true;
            isConnecting = false;
            connectionListeners.forEach(listener => listener(true));
          };

          ws.onmessage = (event) => {
            try {
              const data: UpdateEvent = JSON.parse(event.data);
              // Process update silently
              
              // Handle user-banned event specially - dispatch to window
              if (data.event === 'user-banned') {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('user:banned', { detail: data }));
                }
                return; // Don't call other callbacks for ban events
              }
              
              // Call all registered callbacks
              callbacks.forEach(callback => callback(data));
            } catch (error) {
              console.error('Error parsing WebSocket message:', error);
            }
          };

          ws.onerror = () => {
            // Silently handle WebSocket errors - likely due to not being authenticated
          };

          ws.onclose = (event) => {
            // Only log unexpected closures (not auth-related)
            if (event.code !== 1006 && event.code !== 1000) {
              console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
            }
            globalIsConnected = false;
            globalWs = null;
            isConnecting = false;
            
            connectionListeners.forEach(listener => listener(false));

            // Clear any existing reconnect timeout
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = undefined;
            }

            // Don't reconnect if closed normally (1000) or going away (1001)
            if (event.code === 1000 || event.code === 1001) {
              return;
            }

            // Attempt to reconnect after 5 seconds if there are still active callbacks
            // Silently retry for auth-related failures (1006)
            if (callbacks.size > 0) {
              reconnectTimeout = setTimeout(() => {
                if (callbacks.size > 0 && !globalWs && !isConnecting) {
                  connect();
                }
              }, 5000);
            }
          };
        } catch (error) {
          console.error('Error creating WebSocket connection:', error);
          isConnecting = false;
        }
      };

      connect();
    } else if (globalIsConnected) {
      setIsConnected(true);
    }

    // Listen for WebSocket close event from logout
    const handleWebSocketClose = () => {
      console.log('Closing WebSocket due to logout');
      if (globalWs) {
        globalWs.close(1000, 'User logout');
        globalWs = null;
        globalIsConnected = false;
        isConnecting = false;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('websocket:close', handleWebSocketClose);
    }

    // Cleanup: remove callback when component unmounts
    return () => {
      callbacks.delete(callbackIdRef.current);
      connectionListeners.delete(connectionListener);

      // Remove custom event listener
      if (typeof window !== 'undefined') {
        window.removeEventListener('realtime-update', handleRealtimeUpdate);
      }

      // Remove WebSocket close listener
      if (typeof window !== 'undefined') {
        window.removeEventListener('websocket:close', handleWebSocketClose);
      }

      // Clear any pending close timeout
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = undefined;
      }

      // Schedule a check to close the connection if no more callbacks
      // We use a timeout to batch multiple unmounts together
      closeTimeout = setTimeout(() => {
        if (callbacks.size === 0) {
          console.log('No more listeners, closing WebSocket');
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = undefined;
          }
          if (globalWs) {
            // Close with code 1000 (normal closure) to prevent reconnection
            globalWs.close(1000, 'No more listeners');
            globalWs = null;
            globalIsConnected = false;
            isConnecting = false;
          }
        }
      }, 100); // 100ms debounce to batch unmounts
    };
  }, [enabled]);

  return { isConnected };
}
