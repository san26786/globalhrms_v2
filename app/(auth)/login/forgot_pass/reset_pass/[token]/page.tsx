"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AuthCard, { buttonClass, inputClass, postJson } from "../../../AuthCard";

/** CI login/forgot_pass/reset_pass/{token} → changepass: choose a new password (brand policy applies). */
export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json) => setValid(!!json.data?.valid))
      .catch(() => setValid(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await postJson("/api/auth/reset-password", { token, password, confirmPassword });
    if (result.ok) setDone(true);
    else setError(result.errors?.password?.join(" ") ?? result.errors?.confirmPassword?.[0] ?? result.message);
    setLoading(false);
  };

  return (
    <AuthCard title="Reset Password">
      {valid === null && <p className="text-sm text-center text-slate-400">Checking your link…</p>}
      {valid === false && (
        <p className="text-sm text-center text-red-500">
          This password reset link is invalid or has expired. <Link href="/login/forgot_pass" className="font-semibold text-blue-500">Request a new one</Link>.
        </p>
      )}
      {valid && done && <p className="text-sm text-center text-emerald-600">Password Reset Successfully Done. You can now log in.</p>}
      {valid && !done && (
        <form onSubmit={submit} className="space-y-4">
          <input type="password" required autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <input type="password" required autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Saving…" : "Reset Password"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
