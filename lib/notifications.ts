export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function scheduleNotification(_payload: NotificationPayload) {
  throw new Error("Notification provider not configured");
}
