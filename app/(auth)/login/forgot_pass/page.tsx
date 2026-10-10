"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard, { buttonClass, inputClass, postJson } from "../AuthCard";

/** CI login/forgot_pass — request a password reset link by email. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/forgot-password", { email });
    setMessage({ ok: result.ok, text: result.ok ? result.message : result.errors?.email?.[0] ?? result.message });
    setLoading(false);
  };

  return (
    <AuthCard title="Forgot Password" subtitle="Enter your registered email address and we will send you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <input type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-500"}`}>{message.text}</p>}
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
      <p className="text-center text-xs text-slate-500">
        Forgot your username? <Link href="/login/forgot_username" className="font-semibold text-blue-500">Recover it</Link>
      </p>
    </AuthCard>
  );
}
