/** "Exists in database" indicator for an entity object (1,194 registered CI views were never created in PostgreSQL). */
export default function ExistsBadge({ exists, type }: { exists: boolean; type?: string | null }) {
  return exists ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700" title={type ?? undefined}>
      Exists
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title="Not found in the PostgreSQL schema">
      Missing
    </span>
  );
}
