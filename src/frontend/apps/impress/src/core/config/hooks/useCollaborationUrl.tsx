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
  // So we construct: wss://host/collaboration/ws/{room-id}?room={room-id}
  // HocusPocus will use the 'name' parameter as the document name, which should match the room ID
  const base =
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? `wss://${window.location.host}/collaboration/ws/`
      : '');

  // HocusPocus appends the 'name' parameter to the URL path
  // So if url = "wss://host/collaboration/ws/?room=abc" and name = "abc"
  // It constructs: "wss://host/collaboration/ws/abc?room=abc"
  // We need to include the room query parameter for server validation
  return `${base}?room=${room}`;
};
