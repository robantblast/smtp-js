"use client";

import { useState, type FormEvent } from "react";
import { SMTP_CONFIGS } from "@/lib/smtp-configs";
import type { SmtpCredentials } from "@/lib/types";

interface SmtpFormProps {
  onTest: (credentials: SmtpCredentials) => void;
  isLoading: boolean;
}

export default function SmtpForm({ onTest, isLoading }: SmtpFormProps) {
  const [provider, setProvider] = useState("SendGrid");
  const [testRecipient, setTestRecipient] = useState("");
  const [skipTestEmail, setSkipTestEmail] = useState(false);

  const isSendgrid = provider === "SendGrid";
  const isZeptomail = provider === "ZeptoMail";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const credentials: SmtpCredentials = {
      mode: isZeptomail ? "zeptomail" : "sendgrid",
      testRecipient: testRecipient.trim() || undefined,
      skipTestEmail
    };

    onTest(credentials);
  };

  const isValid = () => Boolean(provider);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-ink-700/60 bg-ink-900/70 p-8 shadow-soft backdrop-blur"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-300">Step 1</p>
        <h2 className="font-display text-3xl text-ink-50">Connect SMTP</h2>
        <p className="text-sm text-ink-200">
          Choose a provider and verify the connection before sending campaigns.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Provider</span>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 shadow-chip focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
          >
            {SMTP_CONFIGS.map((config) => (
              <option key={config.name} value={config.name}>
                {config.displayName || config.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm md:col-span-2">
          <span className="text-ink-200">Test recipient (optional)</span>
          <input
            type="email"
            value={testRecipient}
            onChange={(event) => setTestRecipient(event.target.value)}
            disabled={skipTestEmail}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="yourtestemail@gmail.com"
          />
          <span className="text-xs text-ink-400">
            The test sends an email to the recipient above.
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm md:col-span-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipTestEmail}
            onChange={(event) => setSkipTestEmail(event.target.checked)}
            className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-clay-500 focus:ring-clay-500/20"
          />
          <span className="text-ink-200">Skip test email (verify connection only)</span>
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-ink-300">
          {isSendgrid && <span>SendGrid API mode (env credentials)</span>}
          {isZeptomail && <span>ZeptoMail SMTP mode (env credentials)</span>}
        </div>
        <button
          type="submit"
          disabled={!isValid() || isLoading}
          className="rounded-full bg-clay-500 px-6 py-2 text-sm font-semibold text-ink-900 shadow-chip transition hover:bg-clay-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Connecting..." : "Connect SMTP"}
        </button>
      </div>
    </form>
  );
}
