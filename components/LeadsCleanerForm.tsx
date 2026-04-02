"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { FilterLeadsResponse } from "@/lib/types";

export default function LeadsCleanerForm() {
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [sentLogFile, setSentLogFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FilterLeadsResponse | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!leadsFile || !sentLogFile) return;

    setIsLoading(true);
    setResult(null);

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const formData = new FormData();
      formData.append("leads", leadsFile);
      formData.append("sentLog", sentLogFile);

      const response = await fetch("/api/filter-leads", {
        method: "POST",
        body: formData
      });

      const data: FilterLeadsResponse = await response.json();
      setResult(data);

      if (data.success && data.leads) {
        const json = JSON.stringify(data.leads, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Filter failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = Boolean(leadsFile && sentLogFile);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-ink-700/60 bg-ink-900/70 p-8 shadow-soft backdrop-blur"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-300">Step 3</p>
        <h2 className="font-display text-3xl text-ink-50">Remove sent emails</h2>
        <p className="text-sm text-ink-200">
          Upload your sent log and leads file to generate a fresh list of unsent leads.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Leads JSON/JS (required)</span>
          <input
            type="file"
            accept="application/json,text/javascript,application/javascript,.json,.js"
            onChange={(event) => setLeadsFile(event.target.files?.[0] || null)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-200">Sent log (required)</span>
          <input
            type="file"
            accept="text/plain,.txt"
            onChange={(event) => setSentLogFile(event.target.files?.[0] || null)}
            className="rounded-xl border border-ink-600 bg-ink-800/70 px-3 py-2 text-ink-100"
            required
          />
          <span className="text-xs text-ink-300">Use logs-SENT-*.txt from the project root.</span>
        </label>
      </div>

      {result && (
        <div
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
            result.success
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
              : "border-rose-500/50 bg-rose-500/10 text-rose-100"
          }`}
        >
          <p className="font-semibold">{result.message}</p>
          {result.summary && (
            <p className="mt-1 text-xs text-ink-200">
              Total: {result.summary.total} | Removed: {result.summary.removed} | Remaining:{" "}
              {result.summary.remaining}
            </p>
          )}
          {result.error && <p className="mt-1 text-xs text-rose-200">{result.error}</p>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isReady || isLoading}
          className="rounded-full bg-clay-500 px-6 py-2 text-sm font-semibold text-ink-900 shadow-chip transition hover:bg-clay-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Filtering..." : "Filter Leads"}
        </button>

        {downloadUrl && result?.success && (
          <a
            href={downloadUrl}
            download={result.filename || "leads-unsent.json"}
            className="rounded-full border border-ink-600 px-5 py-2 text-sm font-semibold text-ink-100 transition hover:border-ink-400"
          >
            Download filtered leads
          </a>
        )}
      </div>
    </form>
  );
}
