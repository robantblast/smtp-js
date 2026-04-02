"use client";

import { useMemo, useState, type FormEvent } from "react";
import { SMTP_CONFIGS } from "@/lib/smtp-configs";
import type { SmtpCredentials } from "@/lib/types";

interface SmtpFormProps {
  onTest: (credentials: SmtpCredentials) => void;
  isLoading: boolean;
}

export default function SmtpForm({ onTest, isLoading }: SmtpFormProps) {
  const [provider, setProvider] = useState("SendGrid");
  const [useSendgridApi, setUseSendgridApi] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [senderName, setSenderName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [customPort, setCustomPort] = useState("587");
  const [customSecure, setCustomSecure] = useState(false);

  const selectedConfig = useMemo(
    () => SMTP_CONFIGS.find((item) => item.name === provider),
    [provider]
  );

  const isSendgrid = provider === "SendGrid";
  const showCustom = provider === "Custom";
  const useApiMode = isSendgrid && useSendgridApi;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const credentials: SmtpCredentials = {
      mode: useApiMode ? "sendgrid" : "smtp",
      apiKey: useApiMode ? apiKey : undefined,
      username: useApiMode ? undefined : username,
      password: useApiMode ? undefined : password,
      host: useApiMode ? undefined : showCustom ? customHost : selectedConfig?.host || "",
      port: useApiMode ? undefined : showCustom ? Number(customPort) : selectedConfig?.port || 587,
      secure: useApiMode ? undefined : showCustom ? customSecure : selectedConfig?.secure || false,
      senderName: senderName.trim() || undefined,
      fromEmail: fromEmail.trim() || undefined,
      replyTo: replyTo.trim() || undefined,
      testRecipient: testRecipient.trim() || undefined
    };

    onTest(credentials);
  };

  const isValid = () => {
    if (useApiMode) {
      return Boolean(apiKey && fromEmail);
    }
    if (!username || !password) return false;
    if (showCustom) return Boolean(customHost && customPort && fromEmail);
    return Boolean(selectedConfig && fromEmail);
  };

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

        {isSendgrid && (
          <label className="flex items-center gap-3 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={useSendgridApi}
              onChange={(event) => setUseSendgridApi(event.target.checked)}
              className="h-4 w-4"
            />
            Use SG API key
          </label>
        )}

        {useApiMode ? (
          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span className="text-ink-200">SG API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
              placeholder="SG.xxxxx"
              required
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-ink-200">SMTP Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
                placeholder="apikey or user@example.com"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-ink-200">SMTP Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
                placeholder="Password or API key"
                required
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Sender Name (optional)</span>
          <input
            type="text"
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="Finance Desk"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">From Email (required)</span>
          <input
            type="email"
            value={fromEmail}
            onChange={(event) => setFromEmail(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="billing@yourdomain.com"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Reply-To (optional)</span>
          <input
            type="email"
            value={replyTo}
            onChange={(event) => setReplyTo(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="support@yourdomain.com"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm md:col-span-2">
          <span className="text-ink-200">Test recipient (optional)</span>
          <input
            type="email"
            value={testRecipient}
            onChange={(event) => setTestRecipient(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="yourtestemail@gmail.com"
          />
          <span className="text-xs text-ink-400">
            The test sends an email to the recipient above.
          </span>
        </label>
      </div>

      {showCustom && !useApiMode && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-ink-200">Host</span>
            <input
              type="text"
              value={customHost}
              onChange={(event) => setCustomHost(event.target.value)}
              className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
              placeholder="smtp.example.com"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-ink-200">Port</span>
            <input
              type="number"
              value={customPort}
              onChange={(event) => setCustomPort(event.target.value)}
              className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
              placeholder="587"
              required
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={customSecure}
              onChange={(event) => setCustomSecure(event.target.checked)}
              className="h-4 w-4"
            />
            Use SSL/TLS
          </label>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-ink-300">
          {selectedConfig && !showCustom && !useApiMode && (
            <span>
              {selectedConfig.host}:{selectedConfig.port} ({selectedConfig.secure ? "SSL" : "STARTTLS"})
            </span>
          )}
          {useApiMode && <span>SG API mode enabled</span>}
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
