"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, LockKeyhole } from "lucide-react";
import AuthCard, { postJson } from "../../../AuthCard";
import { Field, LINK, PendingNote, PrimaryButton, StatusMessage } from "@/components/auth/AuthUi";

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
    <AuthCard
      icon={LockKeyhole}
      title="Choose a new password"
      subtitle={valid === false ? undefined : "Pick something strong that you have not used before."}
    >
      {valid === null && <PendingNote>Checking your link…</PendingNote>}
      {valid === false && (
        <StatusMessage ok={false}>
          This password reset link is invalid or has expired.{" "}
          <Link href="/login/forgot_pass" className={LINK}>
            Request a new one
          </Link>
          .
        </StatusMessage>
      )}
      {valid && done && <StatusMessage ok>Password Reset Successfully Done. You can now log in.</StatusMessage>}
      {valid && !done && (
        <form onSubmit={submit} className="space-y-4">
          <Field
            id="reset-password"
            label="New password"
            icon={Lock}
            type="password"
            required
            autoComplete="new-password"
            placeholder="Enter a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field
            id="reset-confirm-password"
            label="Confirm new password"
            icon={Lock}
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat the new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && (
            <StatusMessage key={error} ok={false}>
              {error}
            </StatusMessage>
          )}
          <PrimaryButton loading={loading} loadingText="Saving…">
            Reset password
          </PrimaryButton>
        </form>
      )}
    </AuthCard>
  );
}
