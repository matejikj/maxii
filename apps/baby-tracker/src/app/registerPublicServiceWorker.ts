import { Platform } from 'react-native';

/**
 * Register the public shell service worker on web only. Activation of a new
 * worker should wait for a calm moment; this helper only registers and never
 * forces clients.claim during an open form.
 */
export function registerPublicServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((registration) => {
      // Expose registration outcome for offline readiness probes in tests.
      (globalThis as { __lumiPublicSw?: ServiceWorkerRegistration }).__lumiPublicSw = registration;
    })
    .catch(() => {
      // Offline-first still works from the native install path; web SW is best-effort.
    });
}
