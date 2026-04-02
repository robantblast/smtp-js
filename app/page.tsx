"use client";

import { useEffect, useState } from "react";
import SmtpForm from "@/components/SmtpForm";
import CampaignForm from "@/components/CampaignForm";
import LeadsCleanerForm from "@/components/LeadsCleanerForm";
import ResultMessage from "@/components/ResultMessage";
import type {
  CampaignStatus,
  CampaignStatusResponse,
  SmtpCredentials,
  SendCampaignResponse,
  TestSmtpResponse
} from "@/lib/types";

export default function Home() {
  const [credentials, setCredentials] = useState<SmtpCredentials | null>(null);
  const [testResult, setTestResult] = useState<TestSmtpResponse | null>(null);
  const [campaignResult, setCampaignResult] = useState<SendCampaignResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [liveCampaignId, setLiveCampaignId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<CampaignStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!streamingEnabled || !liveCampaignId) return;

    let active = true;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/campaign-status?campaignId=${encodeURIComponent(liveCampaignId)}`
        );
        const data: CampaignStatusResponse = await response.json();

        if (!active) return;

        if (data.success && data.status) {
          setLiveStatus(data.status);
          if (data.status.state !== "running") {
            setIsPolling(false);
            setLiveCampaignId(null);
          }
        } else if (response.status === 404) {
          setIsPolling(false);
          setLiveCampaignId(null);
        }
      } catch {
        // Ignore polling errors and keep trying.
      }
    };

    setIsPolling(true);
    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [liveCampaignId, streamingEnabled]);

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
        const { testRecipient, ...persisted } = nextCredentials;
        setCredentials(persisted);
      } else {
        setCredentials(null);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "SMTP test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      setCredentials(null);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendCampaign = async (
    payload: FormData,
    options: { campaignId?: string; enableStreaming: boolean }
  ) => {
    if (!credentials) return;

    if (options.enableStreaming && options.campaignId) {
      setLiveStatus(null);
      setLiveCampaignId(options.campaignId);
    } else {
      setLiveCampaignId(null);
      setLiveStatus(null);
    }

    setIsSending(true);
    setCampaignResult(null);

    try {
      payload.append("credentials", JSON.stringify(credentials));

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
          {/* <p className="mt-4 max-w-2xl text-base text-ink-200">
            Upload leads, bank accounts, and letter templates. The sender rotates accounts,
            generates invoice PDFs, and keeps the workflow readable.
          </p> */}
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
            {(liveStatus || (isPolling && streamingEnabled)) && (
              <div className="rounded-3xl border border-ink-700/60 bg-ink-900/60 p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl text-ink-50">Live send stream</h2>
                  <span className="text-xs text-ink-300">
                    {isPolling ? "Live" : liveStatus?.state || "Idle"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-300">
                  Sent: {liveStatus?.sent || 0} | Failed: {liveStatus?.failed || 0} | Total:{" "}
                  {liveStatus?.total || 0}
                </p>
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-2 text-xs text-ink-200">
                  {liveStatus?.events?.length ? (
                    liveStatus.events.map((event, index) => (
                      <div
                        key={`${event.email}-${event.timestamp}-${index}`}
                        className="flex flex-col gap-1 rounded-xl border border-ink-700/60 bg-ink-900/40 px-3 py-2"
                      >
                        <span className="font-semibold">
                          {event.status === "success" ? "Sent" : "Failed"}: {event.email}
                        </span>
                        <span className="text-[11px] text-ink-400">{event.timestamp}</span>
                        {event.error && (
                          <span className="text-[11px] text-rose-200">{event.error}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-ink-400">Waiting for updates...</p>
                  )}
                </div>
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
            credentials={credentials}
            isLoading={isSending}
            enableStreaming={streamingEnabled}
            onToggleStreaming={(value) => {
              setStreamingEnabled(value);
              if (!value) {
                setLiveCampaignId(null);
              }
            }}
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
