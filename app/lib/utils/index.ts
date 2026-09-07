// lib/utils/index.ts
//
// Barrel export for the universal utility framework.
//
// Everything exported here is safe to import from both Client and Server
// Components/code — no Node-only APIs, no secrets, no browser-only APIs.
//
// NOT re-exported here — import directly, per the client/server split:
//   - `@/lib/utils/client` (or `browser.ts` / `export.ts`) — browser-only
//     (DOM, download triggers, clipboard)
//   - `@/lib/utils/server` — server-only (Node `crypto`, reads a secret)
//   - `@/lib/import-export/exportUtils` — the existing browser-only
//     CSV/Excel/PDF/print/clipboard export for the import/export feature;
//     left as-is rather than duplicated (see export.ts for the new,
//     dependency-light CSV-only alternative for other features)

export * from "./cn";
export * from "./types";
export * from "./constants";
export * from "./date";
export * from "./format";
export * from "./string";
export * from "./number";
export * from "./currency";
export * from "./Id";
export * from "./object";
export * from "./validation";
export * from "./csv";