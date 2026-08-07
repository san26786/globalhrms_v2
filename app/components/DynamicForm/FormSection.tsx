"use client";

import React, { ReactNode } from "react";

export interface FormSectionProps {
  /**
   * Section title
   */
  title?: string;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Show/Hide section
   */
  visible?: boolean;

  /**
   * Make section collapsible
   */
  collapsible?: boolean;

  /**
   * Initially collapsed
   */
  defaultCollapsed?: boolean;

  className?: string;

  children: ReactNode;
}

export default function FormSection({
  title,
  description,
  visible = true,
  collapsible = false,
  defaultCollapsed = false,
  className = "",
  children,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`
        rounded-lg
        border
        border-gray-200
        bg-white
        shadow-sm
        ${className}
      `}
    >
      {(title || description) && (
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-base font-semibold text-gray-900">
                  {title}
                </h3>
              )}

              {description && (
                <p className="mt-1 text-sm text-gray-500">
                  {description}
                </p>
              )}
            </div>

            {collapsible && (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="rounded p-2 transition hover:bg-gray-100"
              >
                {collapsed ? "+" : "-"}
              </button>
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="p-6">
          {children}
        </div>
      )}
    </div>
  );
}