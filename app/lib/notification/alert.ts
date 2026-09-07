export type AlertVariant = "default" | "destructive" | "warning";

export interface ConfirmActionOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: AlertVariant;
}

export interface AlertOptions {
  title: string;
  description?: string;
  buttonText?: string;
  variant?: AlertVariant;
}

export interface ModalState {
  isOpen: boolean;
  type: "confirm" | "alert";
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  variant: AlertVariant;
  resolve: (value: boolean) => void;
}

type ModalSubscriber = (state: ModalState | null) => void;

class AlertManager {
  private static instance: AlertManager;
  private subscriber: ModalSubscriber | null = null;

  private constructor() {}

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  public subscribe(fn: ModalSubscriber): () => void {
    this.subscriber = fn;
    return () => {
      if (this.subscriber === fn) {
        this.subscriber = null;
      }
    };
  }

  public confirm(options: ConfirmActionOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.subscriber) {
        // Fallback to browser confirm if UI modal is not mounted yet
        if (typeof window !== "undefined") {
          const res = window.confirm(
            `${options.title}\n\n${options.description || ""}`
          );
          resolve(res);
          return;
        }
        resolve(false);
        return;
      }

      this.subscriber({
        isOpen: true,
        type: "confirm",
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || (options.variant === "destructive" ? "Delete" : "Confirm"),
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || "default",
        resolve,
      });
    });
  }

  public alert(options: AlertOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.subscriber) {
        // Fallback to browser alert if UI modal is not mounted yet
        if (typeof window !== "undefined") {
          window.alert(`${options.title}\n\n${options.description || ""}`);
          resolve();
          return;
        }
        resolve();
        return;
      }

      this.subscriber({
        isOpen: true,
        type: "alert",
        title: options.title,
        description: options.description,
        confirmText: options.buttonText || "OK",
        variant: options.variant || "default",
        resolve: () => resolve(),
      });
    });
  }
}

export const alertManager = AlertManager.getInstance();

/**
 * Trigger a reusable confirmation modal returning Promise<boolean>
 * Returns true if confirmed, false if cancelled
 */
export async function confirmAction(
  options: ConfirmActionOptions
): Promise<boolean> {
  return alertManager.confirm(options);
}

/**
 * Trigger a reusable alert modal returning Promise<void>
 */
export async function showAlert(options: AlertOptions): Promise<void> {
  return alertManager.alert(options);
}
