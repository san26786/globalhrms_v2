import { toast, type ExternalToast } from "sonner";

export interface ToastOptions extends ExternalToast {
  duration?: number;
  description?: string;
}

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastFunction {
  (message: string, options?: ToastOptions): string | number;
  success: (message: string, options?: ToastOptions) => string | number;
  error: (message: string, options?: ToastOptions) => string | number;
  warning: (message: string, options?: ToastOptions) => string | number;
  info: (message: string, options?: ToastOptions) => string | number;
  custom: (jsx: (id: number | string) => React.ReactElement, options?: ToastOptions) => string | number;
  dismiss: (id?: number | string) => void;
  loading: (message: string, options?: ToastOptions) => string | number;
}

const createShowToast = (): ToastFunction => {
  const show = (message: string, options?: ToastOptions) => {
    return toast(message, options);
  };

  show.success = (message: string, options?: ToastOptions) => {
    return toast.success(message, options);
  };

  show.error = (message: string, options?: ToastOptions) => {
    return toast.error(message, options);
  };

  show.warning = (message: string, options?: ToastOptions) => {
    return toast.warning(message, options);
  };

  show.info = (message: string, options?: ToastOptions) => {
    return toast.info(message, options);
  };

  show.custom = (jsx: (id: number | string) => React.ReactElement, options?: ToastOptions) => {
    return toast.custom(jsx, options);
  };

  show.dismiss = (id?: number | string) => {
    toast.dismiss(id);
  };

  show.loading = (message: string, options?: ToastOptions) => {
    return toast.loading(message, options);
  };

  return show as ToastFunction;
};

export const showToast = createShowToast();

// ==========================================
// HRMS-SPECIFIC TOAST HELPERS
// ==========================================

export type EmployeeActionType = "added" | "updated" | "deleted";

/**
 * Reusable toast helper for Employee actions
 */
export function showEmployeeToast(
  action: EmployeeActionType,
  employeeName?: string
): string | number {
  const nameSuffix = employeeName ? ` "${employeeName}"` : "";

  switch (action) {
    case "added":
      return showToast.success(`Employee${nameSuffix} added successfully`);
    case "updated":
      return showToast.success(`Employee${nameSuffix} updated successfully`);
    case "deleted":
      return showToast.info(`Employee${nameSuffix} deleted successfully`);
    default:
      return showToast.success(`Employee action completed`);
  }
}

export type LeaveActionType = "submitted" | "approved" | "rejected";

/**
 * Reusable toast helper for Leave actions
 */
export function showLeaveToast(
  action: LeaveActionType,
  details?: { employeeName?: string; leaveType?: string }
): string | number {
  const context = details?.leaveType ? ` for ${details.leaveType}` : "";

  switch (action) {
    case "submitted":
      return showToast.info(`Leave request${context} submitted successfully`);
    case "approved":
      return showToast.success(`Leave request${context} approved successfully`);
    case "rejected":
      return showToast.warning(`Leave request${context} rejected`);
    default:
      return showToast.info(`Leave status updated`);
  }
}

export type PayrollActionType = "processed" | "payslip_generated";

/**
 * Reusable toast helper for Payroll actions
 */
export function showPayrollToast(
  action: PayrollActionType,
  details?: { month?: string; count?: number }
): string | number {
  const monthSuffix = details?.month ? ` for ${details.month}` : "";
  const countSuffix = details?.count ? ` (${details.count} employees)` : "";

  switch (action) {
    case "processed":
      return showToast.success(`Payroll${countSuffix} processed successfully${monthSuffix}`);
    case "payslip_generated":
      return showToast.success(`Payslip generated successfully${monthSuffix}`);
    default:
      return showToast.success(`Payroll operation completed`);
  }
}

/**
 * Generic error toast helper that safely extracts error messages
 */
export function showGenericErrorToast(
  error?: unknown,
  fallbackMessage = "Something went wrong. Please try again."
): string | number {
  if (!error) {
    return showToast.error(fallbackMessage);
  }

  if (typeof error === "string") {
    return showToast.error(error);
  }

  if (error instanceof Error) {
    return showToast.error(error.message || fallbackMessage);
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return showToast.error(String((error as { message: unknown }).message) || fallbackMessage);
  }

  return showToast.error(fallbackMessage);
}
