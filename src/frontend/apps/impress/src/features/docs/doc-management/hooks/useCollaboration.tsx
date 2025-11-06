import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import { useBroadcastStore } from '@/stores';

import { useProviderStore } from '../stores/useProviderStore';
import { Base64 } from '../types';

export const useCollaboration = (room?: string, initialContent?: Base64) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider } = useBroadcastStore();
  const { provider, createProvider, destroyProvider } = useProviderStore();

  useEffect(() => {
    // Early return if prerequisites not met
    if (!room || !collaborationUrl) {
      return;
    }

    // If provider already exists, don't create another
    // This prevents multiple providers from being created
    if (provider) {
      console.log('[useCollaboration] Provider already exists, skipping creation', {
        room,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log('[useCollaboration] Creating provider', {
      room,
      collaborationUrl,
      timestamp: new Date().toISOString(),
    });

    const newProvider = createProvider(collaborationUrl, room, initialContent);
    setBroadcastProvider(newProvider);
  }, [
    provider,
    collaborationUrl,
    room,
    initialContent,
    createProvider,
    setBroadcastProvider,
  ]);

  /**
   * Destroy the provider when the component unmounts or room changes
   */
  useEffect(() => {
    return () => {
      if (room) {
        console.log('[useCollaboration] Cleanup: destroying provider', {
          room,
          timestamp: new Date().toISOString(),
        });
        destroyProvider();
      }
    };
  }, [destroyProvider, room]);
};
