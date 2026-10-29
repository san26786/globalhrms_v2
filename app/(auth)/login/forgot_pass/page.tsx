"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import AuthCard, { postJson } from "../AuthCard";
import { Field, LINK, PrimaryButton, StatusMessage } from "@/components/auth/AuthUi";

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
    <AuthCard
      icon={KeyRound}
      title="Forgot your password?"
      subtitle="No worries. Enter your registered email address and we will send you a reset link."
      footer={
        <Link href="/login/forgot_username" className={LINK}>
          Forgot username?
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field
          id="forgot-pass-email"
          label="Email address"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {message && (
          <StatusMessage key={message.text} ok={message.ok}>
            {message.text}
          </StatusMessage>
        )}
        <PrimaryButton loading={loading} loadingText="Sending…">
          Send reset link
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}
