import { getRandomValues as expoGetRandomValues } from 'expo-crypto';

/**
 * Noble and other audited crypto helpers expect Web Crypto's getRandomValues.
 * React Native does not always expose it globally; Expo Crypto supplies the
 * platform CSPRNG so keys and salts are never derived from Math.random.
 */
export function installRandomPolyfill(): void {
  const cryptoObject = (globalThis as { crypto?: Crypto }).crypto ?? ({} as Crypto);
  if (typeof cryptoObject.getRandomValues !== 'function') {
    cryptoObject.getRandomValues = expoGetRandomValues as Crypto['getRandomValues'];
  }
  (globalThis as { crypto: Crypto }).crypto = cryptoObject;
}

installRandomPolyfill();
