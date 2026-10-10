/** Small informational note shown above an entity screen. */
export default function HelpNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{children}</div>;
}
