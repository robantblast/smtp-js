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
const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN;
const ZEPTOMAIL_FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL;

function getZeptomailCredentials(): SmtpCredentials {
  if (!ZEPTOMAIL_TOKEN) {
    throw new Error("Missing ZeptoMail config: ZEPTOMAIL_TOKEN is required");
  }

  const fromEmail = ZEPTOMAIL_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("Missing ZeptoMail config: ZEPTOMAIL_FROM_EMAIL is required");
  }

  return {
    mode: "zeptomail",
    host: "smtp.zeptomail.com",
    port: 587,
    secure: false,
    username: "emailapikey",
    password: ZEPTOMAIL_TOKEN,
    fromEmail
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
  if (normalized === "zeptomail") return "zeptomail";
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
          error: "smtpMode must be sendgrid or zeptomail"
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
      addressLine2: String(formData.get("addressLine2") || "") || undefined,
      skipInvoice: String(formData.get("skipInvoice") || "") === "1"
    };

    const credentials =
      smtpMode === "zeptomail" ? getZeptomailCredentials() : getSendgridCredentials(senderEmail);

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
