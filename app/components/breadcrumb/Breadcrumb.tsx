import Link from 'next/link';
import { ChevronRight, Home, Plus, Pencil, Eye } from 'lucide-react';
import type { BreadcrumbMode, ParentMenuInfo } from '@/lib/breadcrumb/types';

// CI: $modeIcons map — FontAwesome icons swapped for lucide-react equivalents
const MODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  add: Plus,
  edit: Pencil,
  view: Eye,
};

interface BreadcrumbProps {
  mode: BreadcrumbMode;
  passedUrl?: string | null;
  parameters?: string | null;
  parent?: ParentMenuInfo | null; // resolved via getParentByUrl before render
}

export default function Breadcrumb({ mode, passedUrl, parameters, parent }: BreadcrumbProps) {
  const normalizedMode = mode.toLowerCase();
  const showModeCrumb = ['add', 'edit', 'view'].includes(normalizedMode);
  const ModeIcon = MODE_ICONS[normalizedMode] ?? ChevronRight;

  return (
    <nav aria-label="Breadcrumb" className="bc-nav">
      <ol className="bc-list flex items-center gap-2 text-sm text-gray-500 brand:text-[#535768] dark:text-[#aab3c5]">
        {/* CI: Home crumb — always first */}
        <li className="bc-item">
          <Link href="/dashboard" aria-label="Home" className="bc-link bc-home flex items-center gap-1">
            <Home className="h-4 w-4" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </li>

        {parent ? (
          // CI: WITH PARENT — Parent › Menu [› Mode]
          <>
            <li className="bc-item flex items-center gap-2">
              <ChevronRight size={15} className="bc-sep" aria-hidden="true" />
              <Link href="#" className="bc-link">
                {parent.parentName}
              </Link>
            </li>
            <li className="bc-item flex items-center gap-2">
              <ChevronRight size={15} className="bc-sep" aria-hidden="true" />
              <Link
                href={normalizedMode === 'list' ? '#' : parent.returnedUrl}
                className={`bc-link ${!showModeCrumb ? 'bc-current font-semibold text-blue-600 brand:text-[#0b5394] dark:text-[#8cb8f0]' : ''}`}
                aria-current={!showModeCrumb ? 'page' : undefined}
              >
                {parent.menuName}
              </Link>
            </li>
          </>
        ) : (
          // CI: WITHOUT PARENT — fallback label
          <li className="bc-item flex items-center gap-2">
            <ChevronRight size={15} className="bc-sep" aria-hidden="true" />
            <Link
              href={!normalizedMode ? '#' : passedUrl ?? '#'}
              className={`bc-link ${!showModeCrumb ? 'bc-current font-semibold text-blue-600 brand:text-[#0b5394] dark:text-[#8cb8f0]' : ''}`}
              aria-current={!showModeCrumb ? 'page' : undefined}
            >
              {parameters}
            </Link>
          </li>
        )}

        {/* CI: mode leaf crumb — add / edit / view only */}
        {showModeCrumb && (
          <li className="bc-item flex items-center gap-2">
            <ChevronRight size={15} className="bc-sep" aria-hidden="true" />
            <span
              className="bc-link bc-current bc-mode flex items-center gap-1 font-semibold text-blue-600 brand:text-[#0b5394] dark:text-[#8cb8f0]"
              aria-current="page"
            >
              <ModeIcon className="h-4 w-4" aria-hidden="true" />
              {normalizedMode.charAt(0).toUpperCase() + normalizedMode.slice(1)}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}