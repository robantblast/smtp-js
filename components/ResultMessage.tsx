"use client";

import type { SendCampaignResponse, TestSmtpResponse } from "@/lib/types";

interface ResultMessageProps {
  title: string;
  result: TestSmtpResponse | SendCampaignResponse;
  onDismiss?: () => void;
}

export default function ResultMessage({ title, result, onDismiss }: ResultMessageProps) {
  const tone = result.success
    ? "bg-emerald-900/30 border-emerald-700/60"
    : "bg-rose-900/30 border-rose-700/60";
  const textTone = result.success ? "text-emerald-200" : "text-rose-200";

  return (
    <div className={`rounded-3xl border p-5 shadow-soft ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-300">{title}</p>
          <p className={`mt-2 text-sm font-medium ${textTone}`}>{result.message}</p>
          {!result.success && result.error && (
            <p className="mt-2 text-xs text-ink-300">{result.error}</p>
          )}
          {"summary" in result && result.summary && (
            <div className="mt-3 text-xs text-ink-200">
              <p>Sent: {result.summary.sent}</p>
              <p>Failed: {result.summary.failed}</p>
            </div>
          )}
          {"logDownloadUrl" in result && result.logDownloadUrl && (
            <a
              href={result.logDownloadUrl}
              className="mt-3 inline-flex w-fit items-center rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1 text-xs text-ink-200 hover:bg-ink-800"
            >
              Download sent log
            </a>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1 text-xs text-ink-200 hover:bg-ink-800"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
