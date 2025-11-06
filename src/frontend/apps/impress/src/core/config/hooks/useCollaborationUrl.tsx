import { useConfig } from '../api';

export const useCollaborationUrl = (room?: string) => {
  const { data: conf } = useConfig();

  if (!room) {
    return;
  }

  // HocusPocus appends the document name (room) to the URL path
  // Nginx strips /collaboration/ and forwards to y-provider
  // So /collaboration/ws/{room-id} becomes /ws/{room-id} on the backend
  // The server expects: /ws/{room-id}?room={room-id}
  // So we construct: wss://host/collaboration/ws/?room={room-id}
  // HocusPocus will append the room ID to create: wss://host/collaboration/ws/{room-id}?room={room-id}
  const base =
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? `wss://${window.location.host}/collaboration/ws/`
      : '');

  // HocusPocus will append the document name (room) to the URL path
  // We need to include the room query parameter for server validation
  // Final URL: ${base}${room}?room=${room}
  return `${base}?room=${room}`;
};
