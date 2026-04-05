import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type {
  CampaignRequest,
  SendCampaignResponse,
  SmtpCredentials
} from "@/lib/types";
import { parseBankAccounts, parseLeads } from "@/lib/campaign/parsers";
import { buildLogFilename } from "@/lib/campaign/logs";
import { sendCampaign } from "@/lib/campaign/sender";

export const runtime = "nodejs";

const DEFAULT_SUBJECT_PREFIX = "";
const DEFAULT_BODY_SUBJECT_PREFIX = "";
const DEFAULT_INVOICE_FILENAME = "lNVRNUMBER.pdf";
const DEFAULT_LETTER_TIMEZONE = "Australia/Adelaide";
const DEFAULT_ATTACHMENT_TIMEZONE = "America/Los_Angeles";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const SENDGRID_REPLY_TO = process.env.SENDGRID_REPLY_TO;
const SENDGRID_SENDER_NAME = process.env.SENDGRID_SENDER_NAME;
const SES_REGION = process.env.SES_REGION || process.env.AWS_REGION;
const SES_ACCESS_KEY_ID = process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SES_SECRET_ACCESS_KEY =
  process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const SES_SESSION_TOKEN = process.env.SES_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
const SES_REPLY_TO = process.env.SES_REPLY_TO;
const SES_SENDER_NAME = process.env.SES_SENDER_NAME;

function getSesCredentials(): SmtpCredentials {
  const sesRegion = SES_REGION;
  const accessKeyId = SES_ACCESS_KEY_ID;
  const secretAccessKey = SES_SECRET_ACCESS_KEY;
  const fromEmail = SES_FROM_EMAIL;

  if (!sesRegion || !accessKeyId || !secretAccessKey || !fromEmail) {
    const missing: string[] = [];
    if (!sesRegion) missing.push("SES_REGION/AWS_REGION");
    if (!accessKeyId) missing.push("SES_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID");
    if (!secretAccessKey) missing.push("SES_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY");
    if (!fromEmail) missing.push("SES_FROM_EMAIL");
    throw new Error(`Missing SES config: ${missing.join(", ")}`);
  }

  return {
    mode: "ses",
    sesRegion,
    sesAccessKeyId: accessKeyId,
    sesSecretAccessKey: secretAccessKey,
    sesSessionToken: SES_SESSION_TOKEN,
    fromEmail,
    replyTo: SES_REPLY_TO || undefined,
    senderName: SES_SENDER_NAME || undefined
  };
}

function getSendgridCredentials(senderEmailOverride?: string): SmtpCredentials {
  if (!SENDGRID_API_KEY) {
    throw new Error("Missing SendGrid config: SENDGRID_API_KEY is required");
  }

  const fromEmail = SENDGRID_FROM_EMAIL || senderEmailOverride;
  if (!fromEmail) {
    throw new Error("Missing SendGrid config: SENDGRID_FROM_EMAIL is required");
  }

  return {
    mode: "sendgrid",
    apiKey: SENDGRID_API_KEY,
    fromEmail,
    replyTo: SENDGRID_REPLY_TO || undefined,
    senderName: SENDGRID_SENDER_NAME || undefined
  };
}

function resolveSmtpMode(value: string | null): SmtpCredentials["mode"] | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "sendgrid") return "sendgrid";
  if (normalized === "ses") return "ses";
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<SendCampaignResponse>> {
  let campaignId: string | undefined;
  let enableStreaming = false;

  try {
    const formData = await request.formData();

    const leadsFile = formData.get("leads") as File | null;
    const bankFile = formData.get("bankAccounts") as File | null;
    const letterFile = formData.get("letter") as File | null;
    const invoiceFile = formData.get("invoiceHtml") as File | null;
    if (!leadsFile || !bankFile || !letterFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required files",
          error: "leads, bankAccounts, and letter are required"
        },
        { status: 400 }
      );
    }
    campaignId = String(formData.get("campaignId") || "").trim() || undefined;
    enableStreaming = String(formData.get("enableStreaming") || "") === "1";
    const invoicePrefixRaw = String(formData.get("invoicePrefix") || "").trim();

    if (!invoicePrefixRaw || invoicePrefixRaw === "$") {
      return NextResponse.json(
        {
          success: false,
          message: "Missing invoice prefix",
          error: "invoicePrefix is required"
        },
        { status: 400 }
      );
    }

    const invoicePrefix = invoicePrefixRaw.startsWith("$")
      ? invoicePrefixRaw
      : `$${invoicePrefixRaw}`;

    const smtpMode = resolveSmtpMode(formData.get("smtpMode") as string | null);
    if (!smtpMode) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing SMTP provider",
          error: "smtpMode must be sendgrid or ses"
        },
        { status: 400 }
      );
    }

    const leadsFilename = leadsFile.name || "leads.json";
    const leadsContent = await leadsFile.text();
    const bankAccountsContent = await bankFile.text();
    const letterTemplate = await letterFile.text();
    const skipValidation = String(formData.get("skipValidation") || "") === "1";
    
    const leads = skipValidation 
      ? parseLeads(leadsContent, leadsFilename)
      : parseLeads(leadsContent, leadsFilename);
    const bankAccounts = parseBankAccounts(bankAccountsContent);
    
    const logFilename = buildLogFilename(leadsFilename);

    let invoiceTemplate = "";
    if (invoiceFile) {
      invoiceTemplate = await invoiceFile.text();
    } else {
      const invoicePath = path.join(process.cwd(), "invoice.html");
      invoiceTemplate = await fs.readFile(invoicePath, "utf-8");
    }

    const senderEmail = String(formData.get("senderEmail") || "") || undefined;

    const requestConfig: CampaignRequest = {
      subjectPrefix: String(formData.get("subjectPrefix") || DEFAULT_SUBJECT_PREFIX || ""),
      bodySubjectPrefix: String(formData.get("bodySubjectPrefix") || DEFAULT_BODY_SUBJECT_PREFIX),
      invoiceFilename: String(formData.get("invoiceFilename") || DEFAULT_INVOICE_FILENAME),
      letterTimezone: String(formData.get("letterTimezone") || DEFAULT_LETTER_TIMEZONE),
      attachmentTimezone: String(formData.get("attachmentTimezone") || DEFAULT_ATTACHMENT_TIMEZONE),
      senderEmail,
      invoicePrefix,
      baseDateTime: String(formData.get("baseDateTime") || "") || undefined,
      campaignId,
      enableStreaming,
      leadsFilename,
      logFilename,
      emailsPerAccount: formData.get("emailsPerAccount")
        ? Number(formData.get("emailsPerAccount"))
        : undefined,
      chunkSize: formData.get("chunkSize") ? Number(formData.get("chunkSize")) : 50,
      interChunkDelayMs: formData.get("interChunkDelayMs")
        ? Number(formData.get("interChunkDelayMs"))
        : 0,
      addressLine1: String(formData.get("addressLine1") || "") || undefined,
      addressLine2: String(formData.get("addressLine2") || "") || undefined
    };

    const credentials =
      smtpMode === "ses" ? getSesCredentials() : getSendgridCredentials(senderEmail);

    // Run the campaign directly (no SQS queue)
    const summary = await sendCampaign({
      leads,
      bankAccounts,
      letterTemplate,
      invoiceTemplate,
      credentials,
      request: requestConfig
    });

    return NextResponse.json({
      success: true,
      message: summary.failed === 0 ? "Campaign completed successfully" : "Campaign completed with some failures",
      campaignId,
      logFilename,
      logDownloadUrl: `/api/campaign-log?filename=${encodeURIComponent(logFilename)}`,
      summary: {
        sent: summary.sent,
        failed: summary.failed
      },
      failures: summary.failures.map(f => ({ email: f.email, error: f.error || "Unknown error" }))
    });
  } catch (error) {
    console.error("send-campaign failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Campaign failed",
        error: message
      },
      { status: 500 }
    );
  }
}
