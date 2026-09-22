import { ChevronRight, LayoutList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Same visual shell as common/common_type/components/BreadcrumbHeader.tsx
 * (rounded-3xl card, breadcrumb, title, add button) — not imported directly
 * because that component hardcodes "Common Type" in its JSX regardless of
 * the `title` prop passed to it, so it isn't actually reusable as-is. This
 * mirrors the same structure correctly parameterized for this module,
 * without editing the common_type file (an unrelated module).
 */
export default function DashboardMenuHeader() {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Utilities</span>
            <ChevronRight size={15} />
            <span className="font-semibold text-blue-600">Dashboard Menu</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <LayoutList className="text-blue-600" />
            <h1 className="text-4xl font-bold">Dashboard Menu</h1>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <Link href="/utilities/dashboard-menu/add">
            <Button size="icon" className="rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
