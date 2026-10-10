"use client";

import { useState } from "react";
import AuthCard, { buttonClass, inputClass, postJson } from "../AuthCard";

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
    <AuthCard title="Forgot Username" subtitle="Enter your registered email and your memorable word or passcode.">
      <form onSubmit={submit} className="space-y-4">
        <input type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        <input type="password" required autoComplete="off" placeholder="Memorable word or passcode" value={memorableWord} onChange={(e) => setMemorableWord(e.target.value)} className={inputClass} />
        {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-500"}`}>{message.text}</p>}
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending…" : "Send Username"}
        </button>
      </form>
    </AuthCard>
  );
}
