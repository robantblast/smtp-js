export type CampaignState = "running" | "completed" | "failed";

export interface CampaignEvent {
  email: string;
  status: "success" | "failed";
  error?: string;
  timestamp: string;
}

export interface CampaignStatus {
  id: string;
  state: CampaignState;
  startedAt: string;
  finishedAt?: string;
  total: number;
  sent: number;
  failed: number;
  events: CampaignEvent[];
  updatedAt: number;
}

const CAMPAIGN_TTL_MS = 2 * 60 * 60 * 1000;
const campaigns = new Map<string, CampaignStatus>();

function cleanupExpired() {
  const now = Date.now();
  for (const [id, status] of campaigns.entries()) {
    if (now - status.updatedAt > CAMPAIGN_TTL_MS) {
      campaigns.delete(id);
    }
  }
}

export function startCampaign(id: string, total: number) {
  cleanupExpired();
  const now = new Date().toISOString();
  campaigns.set(id, {
    id,
    state: "running",
    startedAt: now,
    total,
    sent: 0,
    failed: 0,
    events: [],
    updatedAt: Date.now()
  });
}

export function recordCampaignEvent(id: string, event: CampaignEvent) {
  const campaign = campaigns.get(id);
  if (!campaign) return;

  campaign.events.push(event);
  if (event.status === "success") {
    campaign.sent += 1;
  } else {
    campaign.failed += 1;
  }
  campaign.updatedAt = Date.now();
}

export function finishCampaign(id: string, state: CampaignState = "completed") {
  const campaign = campaigns.get(id);
  if (!campaign) return;

  campaign.state = state;
  campaign.finishedAt = new Date().toISOString();
  campaign.updatedAt = Date.now();
}

export function getCampaignStatus(id: string): CampaignStatus | null {
  cleanupExpired();
  return campaigns.get(id) || null;
}
