"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, Mail, UserRound } from "lucide-react";
import AuthCard, { postJson } from "../AuthCard";
import { Field, LINK, PrimaryButton, StatusMessage } from "@/components/auth/AuthUi";

/** CI login/forgot_username — email + memorable word (or passcode) → username sent by email. */
export default function ForgotUsernamePage() {
  const [email, setEmail] = useState("");
  const [memorableWord, setMemorableWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await postJson("/api/auth/forgot-username", { email, memorableWord });
    setMessage({ ok: result.ok, text: result.message });
    setLoading(false);
  };

  return (
    <AuthCard
      icon={UserRound}
      title="Forgot your username?"
      subtitle="Enter your registered email and your memorable word or passcode, and we will email your username to you."
      footer={
        <Link href="/login/forgot_pass" className={LINK}>
          Forgot password?
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field
          id="forgot-username-email"
          label="Email address"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="forgot-username-word"
          label="Memorable word or passcode"
          icon={Lightbulb}
          type="password"
          required
          autoComplete="off"
          placeholder="Your memorable word or passcode"
          value={memorableWord}
          onChange={(e) => setMemorableWord(e.target.value)}
        />
        {message && (
          <StatusMessage key={message.text} ok={message.ok}>
            {message.text}
          </StatusMessage>
        )}
        <PrimaryButton loading={loading} loadingText="Sending…">
          Send username
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}
