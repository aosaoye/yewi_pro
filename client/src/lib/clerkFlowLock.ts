import type { UserRole } from '@/api/types';

type ErrorListener = (err: string | null) => void;

let clerkExchangeInFlight = false;
let lastClerkError: string | null = null;
let pendingClerkRoles: UserRole[] | undefined;
const errorListeners = new Set<ErrorListener>();

export function isClerkExchangeInFlight(): boolean {
  return clerkExchangeInFlight;
}

export function setClerkExchangeInFlight(value: boolean): void {
  clerkExchangeInFlight = value;
}

export function getLastClerkError(): string | null {
  return lastClerkError;
}

export function setLastClerkError(err: string | null): void {
  lastClerkError = err;
  errorListeners.forEach((cb) => cb(err));
}

export function subscribeClerkError(cb: ErrorListener): () => void {
  errorListeners.add(cb);
  return () => {
    errorListeners.delete(cb);
  };
}

export function setPendingClerkRoles(roles: UserRole[] | undefined): void {
  pendingClerkRoles = roles;
}

export function getPendingClerkRoles(): UserRole[] | undefined {
  return pendingClerkRoles;
}
