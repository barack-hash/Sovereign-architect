/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key; absent means the app runs in local-only mode. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** Clerk user id of the owner — the only account shown the dedication screen. */
  readonly VITE_OWNER_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
