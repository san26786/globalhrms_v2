'use client';

import { useEffect, useState } from 'react';

export type FlashMessages = {
  success?: string;
  info?: string;
  warning?: string;
  danger?: string;
};

/**
 * Ported from the four flashdata alert blocks. In the source, success/
 * info/warning render as static (always-in-DOM-but-hidden) banners,
 * while `danger` gets the extra toast treatment: shown, then auto-hidden
 * after 5s via a fade class swap. That asymmetry is preserved here
 * rather than unifying all four into one toast style.
 *
 * CodeIgniter flashdata was read server-side from the session; in
 * Next.js the equivalent is passing these in as props from a Server
 * Component that read them from cookies, or from a server action's
 * return value — this component itself is presentation-only.
 */
export function FlashMessages({ success, info, warning, danger }: FlashMessages) {
  const [showDanger, setShowDanger] = useState(Boolean(danger));

  useEffect(() => {
    if (!danger) return;
    setShowDanger(true);
    const id = setTimeout(() => setShowDanger(false), 5000);
    return () => clearTimeout(id);
  }, [danger]);

  return (
    <>
      {success && (
        <div className="alert alert-success" role="alert">
          <strong>Success!</strong> <span>{success}</span>
        </div>
      )}
      {info && (
        <div className="alert alert-info" role="alert">
          <strong>Info!</strong> <span>{info}</span>
        </div>
      )}
      {warning && (
        <div className="alert alert-warning" role="alert">
          <strong>Warning!</strong> <span>{warning}</span>
        </div>
      )}
      {danger && showDanger && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          style={{ position: 'fixed', top: 20, right: 20, minWidth: 250, zIndex: 1050 }}
          role="alert"
        >
          <button
            type="button"
            className="close"
            aria-label="Close"
            onClick={() => setShowDanger(false)}
          >
            &times;
          </button>
          <span>{danger}</span>
        </div>
      )}
    </>
  );
}
