// lib/utils/client.ts
//
// Barrel for CLIENT-ONLY utilities (uses window/document/navigator).
// Import from here (or the individual files) in Client Components only —
// never from a Server Component or route handler, and never re-exported
// from the universal `@/lib/utils` barrel.
//
// import { copyText, exportRecordsAsCsv } from "@/lib/utils/client";

export * from "./browser";
export * from "./export";