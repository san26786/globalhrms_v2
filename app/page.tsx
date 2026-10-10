import { redirect } from "next/navigation";

/**
 * Entry point (CI default_controller = login/login). The proxy sends visitors without a session to
 * /login; everyone else lands on the dashboard. (Replaces a client-side localStorage "session" that
 * was not connected to the real authentication.)
 */
export default function HomePage() {
  redirect("/dashboard");
}
