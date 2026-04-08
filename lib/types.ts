export interface Lead {
  email: string;
  name: string;
  title?: string;
  company?: string;
  address?: string;
}

export interface BankAccount {
  senderName: string;
  domain: string;
  replyToEmail: string;
  emailSubject: string;
  invoicePrefix: string;
  bankName?: string;
  bankAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  routingNumber?: string;
  acctName?: string;
  acctNumber?: string;
  ein?: string;
  shola?: string;
  companyName?: string;
}

export interface BankAccountsFile {
  emailsPerAccount?: number;
  accounts: BankAccount[];
}

export interface SmtpCredentials {
  mode: "smtp" | "sendgrid" | "zeptomail";
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  apiKey?: string;
  senderName?: string;
  fromEmail?: string;
  replyTo?: string;
  testRecipient?: string;
}

export interface TestSmtpResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface SendCampaignResponse {
  success: boolean;
  message: string;
  error?: string;
  campaignId?: string;
  logFilename?: string;
  logDownloadUrl?: string;
  summary?: {
    sent: number;
    failed: number;
  };
  failures?: Array<{
    email: string;
    error: string;
  }>;
}

export interface CampaignQueueMessage {
  payloadMode?: "inline" | "s3";
  leads?: {
    filename: string;
    content: string;
  };
  bankAccounts?: {
    filename: string;
    content: string;
  };
  letterTemplate?: string;
  invoiceTemplate?: string;
  storage?: {
    bucket: string;
    prefix: string;
    leadsKey: string;
    bankAccountsKey: string;
    letterKey: string;
    invoiceKey: string;
  };
  credentials: SmtpCredentials;
  request: CampaignRequest;
}

export interface CampaignEvent {
  email: string;
  status: "success" | "failed";
  error?: string;
  timestamp: string;
}

export interface CampaignStatus {
  id: string;
  state: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  total: number;
  sent: number;
  failed: number;
  events: CampaignEvent[];
}

export interface CampaignStatusResponse {
  success: boolean;
  message: string;
  error?: string;
  status?: CampaignStatus;
}

export interface FilterLeadsResponse {
  success: boolean;
  message: string;
  error?: string;
  filename?: string;
  summary?: {
    total: number;
    removed: number;
    remaining: number;
  };
  leads?: unknown[];
}

export interface CampaignRequest {
  subjectPrefix: string;
  bodySubjectPrefix: string;
  invoiceFilename: string;
  letterTimezone: string;
  attachmentTimezone: string;
  senderEmail?: string;
  invoicePrefix?: string;
  baseDateTime?: string;
  campaignId?: string;
  enableStreaming?: boolean;
  leadsFilename?: string;
  logFilename?: string;
  emailsPerAccount?: number;
  chunkSize: number;
  interChunkDelayMs: number;
  addressLine1?: string;
  addressLine2?: string;
  skipInvoice?: boolean;
}
