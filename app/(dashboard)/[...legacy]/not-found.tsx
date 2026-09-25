import Link from "next/link";
import { SearchX } from "lucide-react";

export default function LegacyNotFound() {
  return (
    <div className="mx-auto max-w-lg mt-16 rounded-3xl border bg-white p-8 text-center shadow-sm">
      <SearchX className="mx-auto h-10 w-10 text-slate-400" />
      <h1 className="mt-4 text-lg font-black text-slate-800">Page not available</h1>
      <p className="mt-2 text-sm text-slate-500">
        This page does not exist, or the module has not been migrated to the new application yet.
      </p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
        Back to dashboard
      </Link>
    </div>
  );
}
