"use client";

import LoginActivity, { LOGIN_ACTIVITY_TABS, type ActivityItem } from "../LoginActivity";

/** CI user/login_attempts/activeSessions — the caller's own online sessions ("This Session" flagged). */
function toItem(row: Record<string, unknown>): ActivityItem {
  return {
    id: row.id as number,
    title: (row.userAgent as string) || "Unknown browser",
    badge: row.isCurrent ? "This Session" : undefined,
    lines: [
      `Logged in ${new Date(row.loggedInAt as string).toLocaleString()}`,
      `Last active at ${new Date(row.lastActiveAt as string).toLocaleTimeString()}`,
      [row.location, row.ip && `(${row.ip})`].filter(Boolean).join(" ") || "Location unknown",
    ],
  };
}

export default function ActiveSessionsPage() {
  return (
    <LoginActivity
      title="Active Sessions"
      apiPath="/api/user/login_attempts/active-sessions"
      toItem={toItem}
      tabs={LOGIN_ACTIVITY_TABS("sessions")}
    />
  );
}
