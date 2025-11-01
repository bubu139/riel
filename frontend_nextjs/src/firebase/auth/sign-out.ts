
'use client';
import {
  Auth,
  signOut,
} from 'firebase/auth';

/** Initiate sign out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  // CRITICAL: Call signOut directly. Do NOT use 'await signOut(...)'.
  signOut(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
