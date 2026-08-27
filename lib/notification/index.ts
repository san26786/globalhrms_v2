/**
 * Global HRMS - Notification System (Phase 18)
 * 
 * Unified barrel export for all notification utilities:
 * - Toast (Sonner wrapper + HRMS helpers)
 * - Alert & Confirmation (Promise-based confirmAction + GlobalAlertModal)
 * - Email (Server-ready responsive templates & dispatchers)
 * - SMS (Server-ready SMS templates & dispatchers)
 */

export * from "./toast";
export * from "./alert";
export * from "./email";
export * from "./sms";
export { GlobalAlertModal } from "./components/GlobalAlertModal";
