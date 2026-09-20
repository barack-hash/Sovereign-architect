/**
 * Auth configuration, resolved once at module load.
 *
 * Without a publishable key the app runs in local-only mode: no sign-in, no
 * server sync, everything in this browser's localStorage — which is exactly
 * what the app was before accounts existed, and remains the dev fallback.
 */

export const clerkPublishableKey: string | undefined =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;

export const clerkEnabled = Boolean(clerkPublishableKey);

/** Only this Clerk user sees the post-sign-in dedication screen. */
export const ownerUserId: string | undefined = import.meta.env.VITE_OWNER_USER_ID || undefined;
