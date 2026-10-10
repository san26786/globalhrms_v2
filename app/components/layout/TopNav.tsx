'use client';

import Link from 'next/link';
import type { AppSession } from '../../domain/session/AppSession';
import { useAutoLogout } from '../../hooks/useAutoLogout';
import { useLastActiveHeartbeat } from '../../hooks/useLastActiveHeartbeat';
import { PunchButton } from './PunchButton';
import { ProfileDropdown } from './ProfileDropdown';
import { SettingsDropdown } from './SettingsDropdown';

type Props = {
  session: AppSession;
  initialPunchStatus: 'in' | 'out' | null;
};

export function TopNav({ session, initialPunchStatus }: Props) {
  useAutoLogout({
    enabled: session.isLoggedIn && session.isAdmin !== 2,
    timeoutMs: session.autoLogoutTimeMs,
    // Source never actually redirected on idle (see hook comment) —
    // left as a no-op here too. Pass a real handler to change that.
  });
  useLastActiveHeartbeat(session.isLoggedIn);

  const showLastLogin =
    session.isAdmin !== 2 && session.lastLoginAt && session.lastLoginAt !== '0000-00-00 00:00:00';

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-orange navbar-fixed">
      <button
        className="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#newNav"
        aria-controls="newNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon" />
      </button>
      <div className="collapse navbar-collapse" id="newNav">
        <span className="navbar-text mr-auto" style={{ maxWidth: 232, overflow: 'hidden' }}>
          Welcome to {session.brandName}
        </span>
        {showLastLogin && (
          <span className="navbar-text mr-auto">
            Logged in at {new Date(session.lastLoginAt as string).toLocaleString()}
          </span>
        )}

        <ul className="navbar-nav">
          <li className="nav-item">
            <Link className="nav-link" href="/announcement">
              <i className="fa fa-bell-o" aria-hidden="true" /> Notification ({session.isAdmin} Alert)
            </Link>
          </li>

          {session.isAdmin === 0 && (
            <li className="nav-item">
              <PunchButton
                disabled={session.punchDisable === 'yes'}
                disabledLabel={session.punchRecord}
                initialStatus={initialPunchStatus}
              />
            </li>
          )}

          {session.dashboardUrl && (
            <li className="nav-item">
              <Link className="nav-link" href={session.dashboardUrl}>
                <i className="fa fa-desktop" aria-hidden="true" /> Dashboard
              </Link>
            </li>
          )}

          <li className="nav-item">
            <Link className="nav-link" href="/dashboard">
              <i className="fa fa-bars" aria-hidden="true" /> Main Menu
            </Link>
          </li>

          {session.isAdmin !== 0 && session.switchBrandUrl && (
            <li className="nav-item">
              <Link className="nav-link" href={session.switchBrandUrl}>
                <i className="fa fa-retweet" aria-hidden="true" /> Switch Brand
              </Link>
            </li>
          )}

          <ProfileDropdown session={session} />
          <SettingsDropdown session={session} />

          <li className="nav-item">
            <Link className="nav-link" href="/logout">
              <i className="fa fa-power-off" aria-hidden="true" /> Logout
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
