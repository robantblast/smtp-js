"use client";

import { useState } from "react";
import SmtpForm from "@/components/SmtpForm";
import CampaignForm from "@/components/CampaignForm";
import LeadsCleanerForm from "@/components/LeadsCleanerForm";
import ResultMessage from "@/components/ResultMessage";
import type {
  SmtpCredentials,
  SendCampaignResponse,
  TestSmtpResponse
} from "@/lib/types";

export default function Home() {
  const [testResult, setTestResult] = useState<TestSmtpResponse | null>(null);
  const [campaignResult, setCampaignResult] = useState<SendCampaignResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [smtpMode, setSmtpMode] = useState<SmtpCredentials["mode"] | null>(null);

  const handleTest = async (nextCredentials: SmtpCredentials) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const formData = new FormData();
      formData.append("credentials", JSON.stringify(nextCredentials));

      const response = await fetch("/api/test-smtp", {
        method: "POST",
        body: formData
      });

      const data: TestSmtpResponse = await response.json();
      setTestResult(data);
      if (data.success) {
        setSmtpMode(nextCredentials.mode);
      } else {
        setSmtpMode(null);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "SMTP test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      setSmtpMode(null);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendCampaign = async (payload: FormData) => {
    setIsSending(true);
    setCampaignResult(null);

    try {
      const response = await fetch("/api/send-campaign", {
        method: "POST",
        body: payload
      });

      const data: SendCampaignResponse = await response.json();
      setCampaignResult(data);
    } catch (error) {
      setCampaignResult({
        success: false,
        message: "Campaign failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-48 -right-48 h-96 w-96 rounded-full bg-clay-700/30 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-80 w-80 rounded-full bg-ink-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-clay-800/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="rounded-[32px] border border-ink-700/60 bg-ink-900/70 p-8 shadow-soft backdrop-blur">
          <p className="text-sm uppercase tracking-[0.2em] text-ink-300"></p>
          <h1 className="mt-3 font-display text-4xl text-ink-50 md:text-5xl">
            Send It
          </h1>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SmtpForm onTest={handleTest} isLoading={isTesting} />
          <div className="space-y-4">
            {testResult && (
              <ResultMessage
                title="SMTP Test"
                result={testResult}
                onDismiss={() => setTestResult(null)}
              />
            )}
            {campaignResult && (
              <ResultMessage
                title="Campaign"
                result={campaignResult}
                onDismiss={() => setCampaignResult(null)}
              />
            )}
            {campaignResult?.summary && (
              <div className="rounded-3xl border border-ink-700/60 bg-ink-900/60 p-6 shadow-soft">
                <h2 className="font-display text-2xl text-ink-50">Campaign Results</h2>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-2xl border border-ink-700/40 bg-ink-800/50 p-4">
                    <p className="text-3xl font-bold text-emerald-400">{campaignResult.summary.sent}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-ink-400">Sent</p>
                  </div>
                  <div className="rounded-2xl border border-ink-700/40 bg-ink-800/50 p-4">
                    <p className="text-3xl font-bold text-rose-400">{campaignResult.summary.failed}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-ink-400">Failed</p>
                  </div>
                  <div className="rounded-2xl border border-ink-700/40 bg-ink-800/50 p-4">
                    <p className="text-3xl font-bold text-ink-200">
                      {campaignResult.summary.sent + campaignResult.summary.failed}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-ink-400">Total</p>
                  </div>
                </div>
                {campaignResult.failures && campaignResult.failures.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-ink-300">Failed emails:</p>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-ink-700/40 bg-ink-900/50 p-3">
                      {campaignResult.failures.map((f, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1 text-xs">
                          <span className="truncate text-ink-200">{f.email}</span>
                          <span className="shrink-0 text-rose-300">{f.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {campaignResult.logDownloadUrl && (
                  <a
                    href={campaignResult.logDownloadUrl}
                    className="mt-4 inline-flex w-fit items-center rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1 text-xs text-ink-200 hover:bg-ink-800"
                  >
                    Download sent log
                  </a>
                )}
              </div>
            )}
            <div className="rounded-3xl border border-ink-700/60 bg-ink-900/60 p-6 shadow-soft">
              <h2 className="font-display text-2xl text-ink-50">How it works</h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-300">
                <li>Pick an SMTP provider, test credentials, and lock the connection.</li>
                <li>Upload your leads JSON, bank accounts JSON, and letter template.</li>
                <li>Use the invoice HTML at the project root or upload another file.</li>
                <li>Send in chunks with optional delays to stay within provider limits.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <CampaignForm
            isLoading={isSending}
            smtpMode={smtpMode}
            onSend={handleSendCampaign}
          />
        </section>

        <section>
          <LeadsCleanerForm />
        </section>
      </div>
    </main>
  );
}
