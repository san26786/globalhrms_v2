"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginScreen from "@/components/auth/LoginScreen";

/** Only same-site paths are honoured (CI onlogInURI) — never an absolute or protocol-relative URL. */
function safeReturnPath(from: string | null): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/login")) return null;
  return from;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = (_username: string, redirectTo?: string) => {
    // A forced password change always wins over the page the user was trying to open.
    const target =
      redirectTo === "/user/changepassword"
        ? redirectTo
        : safeReturnPath(searchParams.get("from")) ?? redirectTo ?? "/dashboard";
    router.replace(target);
  };

  return <LoginScreen onLogin={handleLogin} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
