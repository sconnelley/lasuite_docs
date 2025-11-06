import { useConfig } from '../api';

export const useCollaborationUrl = (room?: string) => {
  const { data: conf } = useConfig();

  if (!room) {
    return;
  }

  // HocusPocus appends the document name (room) to the URL path
  // The server expects: /collaboration/{room-id}?room={room-id}
  // So we construct: ${base}${room}?room=${room}
  // The base URL should be just the collaboration endpoint without /ws/ or room ID
  const base =
    conf?.COLLABORATION_WS_URL ||
    (typeof window !== 'undefined'
      ? `wss://${window.location.host}/collaboration/`
      : '');

  // HocusPocus will append the document name (room) to the URL
  // We need to include the room query parameter for server validation
  // Note: HocusPocus constructs the final URL as ${base}${room}?room=${room}
  return `${base}?room=${room}`;
};
