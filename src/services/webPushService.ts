const PUSH_ENABLED_KEY = 'alisms_web_push_enabled_v1';

export type WebPushSupportState = 'unsupported' | 'denied' | 'default' | 'granted';

export function getWebPushPermissionState(): WebPushSupportState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const p = window.Notification.permission;
  if (p === 'granted' || p === 'denied' || p === 'default') return p;
  return 'default';
}

export function isWebPushEnabledLocally(): boolean {
  if (typeof window === 'undefined') return false;
  if (getWebPushPermissionState() !== 'granted') return false;
  try {
    return window.localStorage.getItem(PUSH_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setWebPushEnabledLocally(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PUSH_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

export async function requestAndEnableWebPush(
  authToken?: string | null
): Promise<{ ok: boolean; permission: WebPushSupportState }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, permission: 'unsupported' };
  }

  let permission: NotificationPermission = window.Notification.permission;
  if (permission === 'default') {
    permission = await window.Notification.requestPermission();
  }

  if (permission !== 'granted') {
    setWebPushEnabledLocally(false);
    return { ok: false, permission: permission as WebPushSupportState };
  }

  setWebPushEnabledLocally(true);

  // Ensure Service Worker is active and sync subscription preference with backend
  let swReady = false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      swReady = Boolean(reg);
    }
  } catch {
    // SW optional fallback
  }

  if (authToken) {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          enabled: true,
          swReady,
          userAgent: navigator.userAgent.slice(0, 180),
        }),
      });
    } catch {
      // Non-fatal
    }
  }

  return { ok: true, permission: 'granted' };
}

export async function disableWebPush(authToken?: string | null): Promise<void> {
  setWebPushEnabledLocally(false);
  if (authToken) {
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch {
      // Non-fatal
    }
  }
}

export async function dispatchSystemPushNotification(options: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !isWebPushEnabledLocally()) return;

  const icon = options.icon || '/pwa-192x192.png';
  const tag = options.tag || `alisim-${Date.now()}`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(options.title, {
          body: options.body,
          icon,
          badge: '/pwa-192x192.png',
          tag,
          data: { url: options.url || '/' },
        });
        return;
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_PUSH_NOTIFICATION',
          title: options.title,
          body: options.body,
          icon,
          tag,
          url: options.url || '/',
        });
        return;
      }
    }

    // Direct Notification API fallback
    new window.Notification(options.title, {
      body: options.body,
      icon,
      tag,
    });
  } catch {
    // Silent fallback when OS suppresses background alerts
  }
}
