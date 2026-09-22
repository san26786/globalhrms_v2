'use client';

import Link from 'next/link';
import type { AppSession } from '../../domain/session/AppSession';

/**
 * Ported from the "User Profile" <li class="nav-item dropdown"> block.
 * Bootstrap's data-toggle="dropdown" is replaced with a plain
 * open/close state — no native Bootstrap JS is loaded in this port.
 */
export function ProfileDropdown({ session }: { session: AppSession }) {
  return (
    <li className="nav-item dropdown">
      <a
        className="nav-link dropdown-toggle"
        href="#"
        role="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <i className="fa fa-user-o" aria-hidden="true" /> {session.username ?? 'Username'}
      </a>
      <div className="dropdown-menu">
        <Link className="dropdown-item" href="/user/profile">
          Profile
        </Link>
        <Link className="dropdown-item" href="/user/change-username">
          Update Username
        </Link>
        <Link className="dropdown-item" href="/user/change-password">
          Update Password
        </Link>
        <Link className="dropdown-item" href="/user/security-questions">
          Update Security Questions
        </Link>
        <Link className="dropdown-item" href="/system-info/last-login-details">
          View Last Login Details
        </Link>

        {session.isAdmin !== 0 && (
          <>
            {session.isAdmin === 2 ? (
              <Link className="dropdown-item" href="/system/org-accounts">
                View Accounts Details
              </Link>
            ) : (
              <Link className="dropdown-item" href={`/system/org-accounts/edit/${session.oaId ?? ''}`}>
                View Accounts Details
              </Link>
            )}
            <Link className="dropdown-item" href="/system/oa-brands">
              View Company Info
            </Link>
            {session.isAdmin === 2 && session.application === 'APPBA' && (
              <Link className="dropdown-item" href="/company-officers">
                View Officers Info
              </Link>
            )}
            {session.isAdmin === 2 && (
              <Link className="dropdown-item" href="/partners">
                View Partners
              </Link>
            )}
            <Link className="dropdown-item" href="/user/permission-class">
              View My Permissions
            </Link>
          </>
        )}
      </div>
    </li>
  );
}
