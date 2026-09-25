"use client";

import LoginActivity, { LOGIN_ACTIVITY_TABS, type ActivityItem } from "./LoginActivity";

/** CI user/login_attempts — the caller's own recent logins. */
function toItem(row: Record<string, unknown>): ActivityItem {
  return {
    id: row.id as number,
    title: (row.userAgent as string) || "Unknown browser",
    badge: (row.status as string) || "Success",
    lines: [
      new Date(row.at as string).toLocaleString(),
      [row.location, row.ip && `(${row.ip})`].filter(Boolean).join(" ") || "Location unknown",
    ],
  };
}

export default function LoginAttemptsPage() {
  return <LoginActivity title="Login Attempts" apiPath="/api/user/login_attempts" toItem={toItem} tabs={LOGIN_ACTIVITY_TABS("history")} />;
}
