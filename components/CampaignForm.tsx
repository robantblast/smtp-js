"use client";

import { useState, type FormEvent } from "react";
interface CampaignFormProps {
  isLoading: boolean;
  smtpMode: "smtp" | "sendgrid" | "zeptomail" | null;
  onSend: (payload: FormData) => void;
}

export default function CampaignForm({
  isLoading,
  smtpMode,
  onSend
}: CampaignFormProps) {
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [emailsPerAccount, setEmailsPerAccount] = useState("");
  const [chunkSize, setChunkSize] = useState("50");
  const [delaySeconds, setDelaySeconds] = useState("10");
  const [senderEmail, setSenderEmail] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("$");
  const [baseDateTime, setBaseDateTime] = useState("");
  const [skipValidation, setSkipValidation] = useState(false);
  const [skipInvoice, setSkipInvoice] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");

  const normalizeInvoicePrefix = (value: string) => {
    const trimmed = value.trimStart();
    if (!trimmed) return "$";
    if (trimmed.startsWith("$")) return trimmed;
    return `$${trimmed}`;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!leadsFile || !bankFile || !letterFile) return;

    const payload = new FormData();
    payload.append("leads", leadsFile);
    payload.append("bankAccounts", bankFile);
    payload.append("letter", letterFile);

    if (invoiceFile) {
      payload.append("invoiceHtml", invoiceFile);
    }

    payload.append("senderEmail", senderEmail);

    const normalizedInvoicePrefix = normalizeInvoicePrefix(invoicePrefix);
    if (!normalizedInvoicePrefix || normalizedInvoicePrefix.trim() === "$") return;
    payload.append("invoicePrefix", normalizedInvoicePrefix);

    if (baseDateTime) {
      payload.append("baseDateTime", baseDateTime);
    }

    if (emailsPerAccount) payload.append("emailsPerAccount", emailsPerAccount);
    if (chunkSize) payload.append("chunkSize", chunkSize);
    if (delaySeconds) {
      const delayValue = Number(delaySeconds);
      const msValue = Number.isFinite(delayValue) ? Math.max(0, delayValue) * 1000 : 0;
      payload.append("interChunkDelayMs", String(msValue));
    }

    if (smtpMode) {
      payload.append("smtpMode", smtpMode);
    }

    if (skipValidation) {
      payload.append("skipValidation", "1");
    }

    if (skipInvoice) {
      payload.append("skipInvoice", "1");
    }

    if (customSubject.trim()) {
      payload.append("customSubject", customSubject.trim());
    }

    if (addressLine1.trim()) {
      payload.append("addressLine1", addressLine1.trim());
    }
    if (addressLine2.trim()) {
      payload.append("addressLine2", addressLine2.trim());
    }

    onSend(payload);
  };

  const isInvoicePrefixValid = invoicePrefix.trim().length > 1 && invoicePrefix.trim() !== "$";
  const isReady = leadsFile && bankFile && letterFile && isInvoicePrefixValid;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-ink-700/60 bg-ink-900/70 p-8 shadow-soft backdrop-blur"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-300">Step 2</p>
        <h2 className="font-display text-3xl text-ink-50">Send the campaign</h2>
        <p className="text-sm text-ink-200">
          Provide the data files and templates used to generate each message.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Leads JSON/JS (required)</span>
          <input
            type="file"
            accept="application/json,text/javascript,application/javascript,.json,.js"
            onChange={(event) => setLeadsFile(event.target.files?.[0] || null)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100"
            required
          />
          <span className="text-xs text-ink-300">
            JS files must export an array via module.exports or export default.
          </span>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Bank accounts JSON (required)</span>
          <input
            type="file"
            accept="application/json"
            onChange={(event) => setBankFile(event.target.files?.[0] || null)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Letter template (required)</span>
          <input
            type="file"
            accept="text/plain,text/html"
            onChange={(event) => setLetterFile(event.target.files?.[0] || null)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Invoice HTML (optional)</span>
          <input
            type="file"
            accept="text/html"
            onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100"
          />
          <span className="text-xs text-ink-300">
            If empty, the server will use invoice.html at the project root.
          </span>
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">
            Sender email override
            <span
              className="ml-2 cursor-help text-ink-400"
              title="Overrides the From email for this campaign only. Leave blank to use SMTP/SendGrid From."
            >
              (?)
            </span>
          </span>
          <input
            type="email"
            value={senderEmail}
            onChange={(event) => setSenderEmail(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="billing@domain.com"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">
            Custom subject
            <span
              className="ml-2 cursor-help text-ink-400"
              title="Overrides the subject line. Supports placeholders like FNAME, INVOICECODE, etc."
            >
              (?)
            </span>
          </span>
          <input
            type="text"
            value={customSubject}
            onChange={(event) => setCustomSubject(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="Invoice #INVOICECODE for FNAME"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Emails per account</span>
          <input
            type="number"
            value={emailsPerAccount}
            onChange={(event) => setEmailsPerAccount(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="Use JSON value"
            min={1}
          />
          <span className="text-xs text-ink-300">
            How many emails to send before rotating to the next bank account.
          </span>
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Invoice prefix (required)</span>
          <input
            type="text"
            value={invoicePrefix}
            onChange={(event) => setInvoicePrefix(normalizeInvoicePrefix(event.target.value))}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="$39"
            required
            minLength={2}
          />
          <span className="text-xs text-ink-300">
            Used to generate invoice amounts. Starts with $ automatically.
          </span>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Base date/time (US Eastern)</span>
          <input
            type="datetime-local"
            value={baseDateTime}
            onChange={(event) => setBaseDateTime(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
          />
          <span className="text-xs text-ink-300">
            Enter the date/time in America/New_York. Used to fill thread dates.
          </span>
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 text-sm text-ink-200">
          <input
            type="checkbox"
            checked={skipValidation}
            onChange={(event) => setSkipValidation(event.target.checked)}
            className="h-4 w-4"
          />
          Skip lead validation before upload
        </label>
        <span className="text-xs text-ink-300">
          Skipping validation uploads faster but bad leads will fail during send.
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 text-sm text-ink-200">
          <input
            type="checkbox"
            checked={skipInvoice}
            onChange={(event) => setSkipInvoice(event.target.checked)}
            className="h-4 w-4"
          />
          Don't attach invoice
        </label>
        <span className="text-xs text-ink-300">
          Send emails without the PDF invoice attachment.
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Address Line 1 (optional)</span>
          <input
            type="text"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="5060 California Avenue"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Address Line 2 (optional)</span>
          <input
            type="text"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            placeholder="Bakersfield, CA 93309"
          />
          <span className="text-xs text-ink-300">
            Overrides BANKADDRESS1, BANKADDRESS2, BANKADDRESSW91, BANKADDRESSW92 placeholders.
          </span>
        </label>
      </div>


      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Chunk size</span>
          <input
            type="number"
            value={chunkSize}
            onChange={(event) => setChunkSize(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            min={1}
          />
          <span className="text-xs text-ink-300">
            How many emails are sent in parallel before the next pause.
          </span>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Delay between chunks (seconds)</span>
          <input
            type="number"
            value={delaySeconds}
            onChange={(event) => setDelaySeconds(event.target.value)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100 placeholder:text-ink-400 focus:border-clay-400 focus:outline-none focus:ring-2 focus:ring-clay-500/20"
            min={0}
          />
          <span className="text-xs text-ink-300">
            Wait time in seconds between each chunk to avoid throttling.
          </span>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={!isReady || isLoading}
          className="rounded-full bg-clay-500 px-6 py-2 text-sm font-semibold text-ink-900 shadow-chip transition hover:bg-clay-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send Campaign"}
        </button>
      </div>
    </form>
  );
}
