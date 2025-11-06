import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/docs/doc-management';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDoc?: Base64,
  ) => HocuspocusProvider;
  destroyProvider: () => void;
  provider: HocuspocusProvider | undefined;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
};

// Track consecutive failures per room to prevent rapid reconnection loops
const failureTracker = new Map<string, { count: number; lastFailureTime: number }>();
const MAX_CONSECUTIVE_FAILURES = 5;
const FAILURE_RESET_TIME = 30000; // 30 seconds

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDoc) => {
    // Destroy existing provider if one exists to prevent multiple connections
    const existingProvider = get().provider;
    if (existingProvider) {
      console.warn('[WebSocket] Destroying existing provider before creating new one', {
        room: storeId,
        timestamp: new Date().toISOString(),
      });
      existingProvider.destroy();
    }
    
    // Reset failure tracker for this room when creating a new provider
    failureTracker.set(storeId, { count: 0, lastFailureTime: 0 });

    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDoc) {
      Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
    }

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: storeId,
      document: doc,
      // HocuspocusProvider handles reconnection automatically with built-in backoff
      // No need to configure maxAttempts or delay - those are not supported options
      onDisconnect(_data) {
        // HocuspocusProvider handles reconnection automatically
        // Manual reconnection can cause duplicate connections and reconnection loops
        // Removed manual reconnect() call to let HocuspocusProvider handle reconnections
        console.log('[WebSocket] Disconnected from collaboration server', {
          room: storeId,
          timestamp: new Date().toISOString(),
        });
      },
      onConnect() {
        // Reset failure tracker on successful connection
        failureTracker.set(storeId, { count: 0, lastFailureTime: 0 });
        
        console.log('[WebSocket] Connected to collaboration server', {
          room: storeId,
          timestamp: new Date().toISOString(),
        });
      },
      onAuthenticationFailed() {
        console.warn('[WebSocket] Authentication failed', {
          room: storeId,
          timestamp: new Date().toISOString(),
        });
        set({ isReady: true });
      },
      onStatus: ({ status }) => {
        const prevState = get();
        const nextConnected = status === WebSocketStatus.Connected;
        const statusChanged = prevState.isConnected !== nextConnected;
        
        // Log status changes for monitoring
        // Note: status is a number (WebSocketStatus enum value), not a string
        if (statusChanged) {
          console.log('[WebSocket] Status changed', {
            room: storeId,
            previousStatus: prevState.isConnected ? 'connected' : 'disconnected',
            newStatus: nextConnected ? 'connected' : 'disconnected',
            statusCode: status,
            statusName: WebSocketStatus[status] || 'Unknown',
            timestamp: new Date().toISOString(),
          });
        }
        
        set((state) => {
          return {
            isConnected: nextConnected,
            isReady: state.isReady || status === WebSocketStatus.Disconnected,
            hasLostConnection:
              state.isConnected && !nextConnected
                ? true
                : state.hasLostConnection,
          };
        });
      },
      onSynced: ({ state }) => {
        console.log('[WebSocket] Document synced', {
          room: storeId,
          synced: state,
          timestamp: new Date().toISOString(),
        });
        set({ isSynced: state, isReady: true });
      },
      onClose(data) {
        /**
         * Handle the "Reset Connection" event from the server
         * This is triggered when the server wants to reset the connection
         * for clients in the room.
         * A disconnect is made automatically but it takes time to be triggered,
         * so we force the disconnection here.
         * 
         * Code 1005 = No Status Received (abnormal closure)
         * Code 1000 = Normal Closure
         */
        const closeCode = data.event.code;
        const closeReason = data.event.reason || 'No reason provided';
        const now = Date.now();
        
        // Get failure tracker for this room
        const tracker = failureTracker.get(storeId) || { count: 0, lastFailureTime: 0 };
        
        // Track consecutive failures for abnormal closures
        if (closeCode === 1005) {
          // Reset failure count if enough time has passed
          if (now - tracker.lastFailureTime > FAILURE_RESET_TIME) {
            tracker.count = 0;
          }
          tracker.count++;
          tracker.lastFailureTime = now;
          failureTracker.set(storeId, tracker);
        } else {
          // Reset failure count on normal closure or other codes
          failureTracker.set(storeId, { count: 0, lastFailureTime: 0 });
        }
        
        console.log('[WebSocket] Connection closed', {
          room: storeId,
          code: closeCode,
          reason: closeReason,
          isNormalClosure: closeCode === 1000,
          isAbnormalClosure: closeCode === 1005,
          consecutiveFailures: tracker.count,
          timestamp: new Date().toISOString(),
        });
        
        // Only handle normal closure (code 1000) - server-initiated reset
        // For abnormal closures (1005), let HocuspocusProvider handle reconnection
        if (closeCode === 1000) {
          provider.disconnect();
        }
        
        // For code 1005 (abnormal closure), log warning but don't interfere
        // HocuspocusProvider will attempt to reconnect automatically
        // But if we have too many consecutive failures, stop reconnecting
        if (closeCode === 1005) {
          if (tracker.count >= MAX_CONSECUTIVE_FAILURES) {
            console.error('[WebSocket] Too many consecutive failures. Stopping reconnection attempts.', {
              room: storeId,
              consecutiveFailures: tracker.count,
              reason: closeReason,
              timestamp: new Date().toISOString(),
            });
            // Stop reconnection by destroying the provider
            provider.destroy();
            set(defaultValues);
            // Clear failure tracker
            failureTracker.delete(storeId);
          } else {
            console.warn('[WebSocket] Abnormal closure detected (code 1005). HocuspocusProvider will attempt reconnection.', {
              room: storeId,
              consecutiveFailures: tracker.count,
              reason: closeReason,
              timestamp: new Date().toISOString(),
            });
          }
        }
      },
    });

    set({
      provider,
    });

    return provider;
  },
  destroyProvider: () => {
    const provider = get().provider;
    if (provider) {
      provider.destroy();
    }

    set(defaultValues);
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
}));
