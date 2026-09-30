// Browser notifications for price alerts. No-ops where unsupported.

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestNotify() {
  if (!notifySupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notify(title, body) {
  try {
    if (notifySupported() && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* notifications are best-effort */
  }
}
