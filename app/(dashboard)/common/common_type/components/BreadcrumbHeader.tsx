import { ChevronRight, Database, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BreadcrumbHeader() {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">

      <div className="flex items-start justify-between">

        <div>

          <div className="flex items-center gap-2 text-sm text-gray-500">

            <span>Master Data Manager</span>

            <ChevronRight size={15} />

            <span className="font-semibold text-blue-600">
              Common Type
            </span>

          </div>

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-blue-600" />
            <h1 className="text-4xl font-bold">
              Common Type
            </h1>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/common/common_type/add">
            <Button size="icon" className="rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>

      </div>

    </div>
  );
}