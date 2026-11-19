export type BackendSession = Readonly<{ endpoint: string; token: string }>;
let session: BackendSession | null = null;
const listeners = new Set<() => void>();
export const getBackendSession = () => session;
export function setBackendSession(value: BackendSession | null) {
  session = value ? Object.freeze({ endpoint: value.endpoint, token: value.token }) : null;
  listeners.forEach((listener) => listener());
}
export function subscribeBackendSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
