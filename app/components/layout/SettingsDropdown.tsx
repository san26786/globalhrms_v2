'use client';

import Link from 'next/link';
import type { AppSession } from '../../domain/session/AppSession';
import { settingsMenuItems } from '../../lib/settingsMenuConfig';

/** Whole dropdown only renders when is_admin != 0, matching source. */
export function SettingsDropdown({ session }: { session: AppSession }) {
  if (session.isAdmin === 0) return null;

  const items = settingsMenuItems.filter((item) => item.visible(session));

  return (
    <li className="nav-item dropdown">
      <a
        className="nav-link dropdown-toggle"
        href="#"
        role="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <i className="fa fa-cog" aria-hidden="true" /> Settings
      </a>
      <div className="dropdown-menu">
        {items.map((item) => (
          <Link key={item.label} className="dropdown-item" href={item.href(session)}>
            {item.label}
          </Link>
        ))}
      </div>
    </li>
  );
}
