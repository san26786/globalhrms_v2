import { notFound, redirect } from "next/navigation";
import { parseHref, resolveCiUrl } from "@/lib/navigation/routeRegistry";

/**
 * Old CodeIgniter URLs (bookmarks, e-mailed links, hard-coded links in content), e.g.
 * /bankmanager/bankdetails or /common/indp_mst_data/index/57, reach this catch-all because no
 * Next page has that path. A migrated CI screen redirects to its Next route (query string kept);
 * anything else is a 404. Real Next routes always win over this catch-all.
 */
export default async function LegacyCiRoute({
  params,
  searchParams,
}: {
  params: Promise<{ legacy: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ legacy }, query] = await Promise.all([params, searchParams]);
  const requestedPath = `/${legacy.join("/")}`;
  const resolved = resolveCiUrl(legacy.map((s) => decodeURIComponent(s)).join("/"));

  if (resolved.kind === "internal") {
    const target = parseHref(resolved.href);
    if (target.path !== requestedPath) {
      // Keep the caller's query parameters; the menu target's own parameters win.
      const merged = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) merged.append(key, v);
      }
      for (const [key, value] of target.query) merged.set(key, value);
      const qs = merged.toString();
      redirect(qs ? `${target.path}?${qs}` : target.path);
    }
  }

  notFound();
}
