export type RealtimeEvent = {
  channel: string;
  name: string;
  payload: Record<string, unknown>;
};

export async function publishRealtimeEvent(_event: RealtimeEvent) {
  throw new Error("Realtime provider not configured");
}
