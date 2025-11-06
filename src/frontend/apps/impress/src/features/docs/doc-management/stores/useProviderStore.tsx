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

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDoc) => {
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
      // Reconnection configuration
      // Limit reconnection attempts to prevent infinite loops
      maxAttempts: 5,
      // Start with 1 second delay, exponential backoff handled by HocuspocusProvider
      delay: 1000,
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
        if (statusChanged) {
          console.log('[WebSocket] Status changed', {
            room: storeId,
            previousStatus: prevState.isConnected ? 'connected' : 'disconnected',
            newStatus: nextConnected ? 'connected' : 'disconnected',
            status: WebSocketStatus[status],
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
         */
        console.log('[WebSocket] Connection closed', {
          room: storeId,
          code: data.event.code,
          reason: data.event.reason,
          wasClean: data.event.wasClean,
          timestamp: new Date().toISOString(),
        });
        if (data.event.code === 1000) {
          provider.disconnect();
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
