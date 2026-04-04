"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
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
  type LiveFeedItem = {
    id: string;
    email: string;
    status: "success" | "failed";
    error?: string;
    timestamp: string;
  };

  const [testResult, setTestResult] = useState<TestSmtpResponse | null>(null);
  const [campaignResult, setCampaignResult] = useState<SendCampaignResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [smtpMode, setSmtpMode] = useState<SmtpCredentials["mode"] | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [liveCampaignId, setLiveCampaignId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<CampaignStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const liveFeedTimeouts = useRef(new Map<string, number>());
  const lastPolledIndexRef = useRef(0);
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  const isPusherEnabled = Boolean(pusherKey && pusherCluster);
  const isCampaignFinished = Boolean(liveStatus && liveStatus.state !== "running");
  const campaignLogUrl = campaignResult?.logDownloadUrl;

  const clearLiveFeed = () => {
    liveFeedTimeouts.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    liveFeedTimeouts.current.clear();
    setLiveFeed([]);
    lastPolledIndexRef.current = 0;
  };

  const pushLiveFeed = (item: LiveFeedItem) => {
    setLiveFeed((current) => [...current, item].slice(-6));

    const timeoutId = window.setTimeout(() => {
      setLiveFeed((current) => current.filter((entry) => entry.id !== item.id));
      liveFeedTimeouts.current.delete(item.id);
    }, 2500);

    liveFeedTimeouts.current.set(item.id, timeoutId);
  };

  useEffect(() => {
    if (!streamingEnabled || !liveCampaignId || !isPusherEnabled) return;

    const channelName = `campaign-${liveCampaignId}`;
    const pusher = new Pusher(pusherKey as string, {
      cluster: pusherCluster as string
    });
    const channel = pusher.subscribe(channelName);

    const ensureStatus = (current: CampaignStatus | null) => {
      if (current) return current;

      return {
        id: liveCampaignId,
        state: "running",
        startedAt: new Date().toISOString(),
        total: 0,
        sent: 0,
        failed: 0,
        events: []
      } satisfies CampaignStatus;
    };

    const handleStart = (payload: { total?: number; startedAt?: string }) => {
      clearLiveFeed();
      setLiveStatus({
        id: liveCampaignId,
        state: "running",
        startedAt: payload.startedAt || new Date().toISOString(),
        total: payload.total ?? 0,
        sent: 0,
        failed: 0,
        events: []
      });
    };

    const handleEvent = (payload: {
      email: string;
      status: "success" | "failed";
      error?: string;
      timestamp?: string;
    }) => {
      setLiveStatus((current) => {
        const base = ensureStatus(current);
        const event = {
          email: payload.email,
          status: payload.status,
          error: payload.error,
          timestamp: payload.timestamp || new Date().toISOString()
        };

        pushLiveFeed({
          id: `${payload.email}-${payload.timestamp || Date.now()}-${Math.random()}`,
          email: payload.email,
          status: payload.status,
          error: payload.error,
          timestamp: payload.timestamp || new Date().toISOString()
        });

        return {
          ...base,
          sent: base.sent + (payload.status === "success" ? 1 : 0),
          failed: base.failed + (payload.status === "failed" ? 1 : 0),
          events: [...base.events, event]
        };
      });
    };

    const handleFinish = (payload: {
      state?: "completed" | "failed";
      finishedAt?: string;
      summary?: { sent: number; failed: number };
    }) => {
      setLiveStatus((current) => {
        const base = ensureStatus(current);

        return {
          ...base,
          state: payload.state || "completed",
          finishedAt: payload.finishedAt || new Date().toISOString(),
          sent: payload.summary?.sent ?? base.sent,
          failed: payload.summary?.failed ?? base.failed
        };
      });
    };

    channel.bind("campaign-start", handleStart);
    channel.bind("campaign-event", handleEvent);
    channel.bind("campaign-finish", handleFinish);

    setIsPolling(true);

    return () => {
      channel.unbind("campaign-start", handleStart);
      channel.unbind("campaign-event", handleEvent);
      channel.unbind("campaign-finish", handleFinish);
      pusher.unsubscribe(channelName);
      pusher.disconnect();
      setIsPolling(false);
    };
  }, [streamingEnabled, liveCampaignId, isPusherEnabled, pusherKey, pusherCluster]);

  useEffect(() => {
    if (isPusherEnabled) return;
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
          if (!isSending) {
            setIsPolling(false);
            setLiveCampaignId(null);
          }
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
  }, [liveCampaignId, streamingEnabled, isSending, isPusherEnabled]);

  useEffect(() => {
    if (isPusherEnabled) return;
    if (!liveStatus?.events?.length) return;

    const startIndex = lastPolledIndexRef.current;
    const newEvents = liveStatus.events.slice(startIndex);
    if (newEvents.length === 0) return;

    newEvents.forEach((event) => {
      pushLiveFeed({
        id: `${event.email}-${event.timestamp}-${Math.random()}`,
        email: event.email,
        status: event.status,
        error: event.error,
        timestamp: event.timestamp
      });
    });

    lastPolledIndexRef.current = liveStatus.events.length;
  }, [liveStatus, isPusherEnabled]);

  useEffect(() => {
    return () => {
      clearLiveFeed();
    };
  }, []);

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

  const handleSendCampaign = async (
    payload: FormData,
    options: { campaignId?: string; enableStreaming: boolean }
  ) => {
    if (options.enableStreaming && options.campaignId) {
      setLiveStatus(null);
      setLiveCampaignId(options.campaignId);
      clearLiveFeed();
    } else {
      setLiveCampaignId(null);
      setLiveStatus(null);
      clearLiveFeed();
    }

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
                  {liveFeed.length ? (
                    liveFeed.map((event) => (
                      <div
                        key={event.id}
                        title={event.error}
                        className="flex items-center justify-between gap-3 rounded-full border border-ink-700/60 bg-ink-900/40 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              event.status === "success"
                                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                                : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.6)]"
                            }`}
                          />
                          <span className="truncate text-ink-100">{event.email}</span>
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-[0.2em] ${
                            event.status === "success" ? "text-emerald-200" : "text-rose-200"
                          }`}
                        >
                          {event.status === "success" ? "Sent" : "Failed"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-ink-400">Waiting for updates...</p>
                  )}
                </div>
                {isCampaignFinished && campaignLogUrl && (
                  <a
                    href={campaignLogUrl}
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
            enableStreaming={streamingEnabled}
            smtpMode={smtpMode}
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
