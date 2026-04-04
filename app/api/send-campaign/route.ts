import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  CampaignQueueMessage,
  CampaignRequest,
  SendCampaignResponse,
  SmtpCredentials
} from "@/lib/types";
import { parseBankAccounts, parseLeads } from "@/lib/campaign/parsers";
import { buildLogFilename } from "@/lib/campaign/logs";

export const runtime = "nodejs";

const DEFAULT_SUBJECT_PREFIX = "";
const DEFAULT_BODY_SUBJECT_PREFIX = "";
const DEFAULT_INVOICE_FILENAME = "lNVRNUMBER.pdf";
const DEFAULT_LETTER_TIMEZONE = "Australia/Adelaide";
const DEFAULT_ATTACHMENT_TIMEZONE = "America/Los_Angeles";
const MAX_SQS_MESSAGE_BYTES = 256 * 1024;

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_PREFIX = process.env.S3_PREFIX || "campaigns";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const SENDGRID_REPLY_TO = process.env.SENDGRID_REPLY_TO;
const SENDGRID_SENDER_NAME = process.env.SENDGRID_SENDER_NAME;
const SES_REGION = process.env.SES_REGION || AWS_REGION;
const SES_ACCESS_KEY_ID = process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SES_SECRET_ACCESS_KEY =
  process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const SES_SESSION_TOKEN = process.env.SES_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;
const SES_REPLY_TO = process.env.SES_REPLY_TO;
const SES_SENDER_NAME = process.env.SES_SENDER_NAME;
const sqsClient = AWS_REGION ? new SQSClient({ region: AWS_REGION }) : null;
const s3Client = AWS_REGION ? new S3Client({ region: AWS_REGION }) : null;

function resolveContentType(filename: string, fallback: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".js") return "text/javascript";
  if (ext === ".html" || ext === ".htm") return "text/html";
  if (ext === ".txt") return "text/plain";
  return fallback;
}

function getQueueConfig() {
  if (!AWS_REGION) {
    throw new Error("AWS region is required (set AWS_REGION)");
  }

  if (!SQS_QUEUE_URL) {
    throw new Error("SQS queue URL is required (set SQS_QUEUE_URL)");
  }

  if (!sqsClient) {
    throw new Error("SQS client failed to initialize");
  }

  return { client: sqsClient, queueUrl: SQS_QUEUE_URL };
}

function getStorageConfig() {
  if (!AWS_REGION) {
    throw new Error("AWS region is required (set AWS_REGION)");
  }

  if (!S3_BUCKET) {
    throw new Error("S3 bucket is required (set S3_BUCKET)");
  }

  if (!s3Client) {
    throw new Error("S3 client failed to initialize");
  }

  const prefix = S3_PREFIX.replace(/\/+$/g, "");
  return { client: s3Client, bucket: S3_BUCKET, prefix: prefix || "campaigns" };
}

async function uploadTextObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: string,
  contentType: string
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

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
    const bankFilename = bankFile.name || "bankAccounts.json";
    const bankAccountsContent = await bankFile.text();
    const letterTemplate = await letterFile.text();
    const letterFilename = letterFile.name || "letter.txt";
    const skipValidation = String(formData.get("skipValidation") || "") === "1";
    if (!skipValidation) {
      parseLeads(leadsContent, leadsFilename);
      parseBankAccounts(bankAccountsContent);
    }
    const logFilename = buildLogFilename(leadsFilename);

    let invoiceTemplate = "";
    if (invoiceFile) {
      invoiceTemplate = await invoiceFile.text();
    } else {
      const invoicePath = path.join(process.cwd(), "invoice.html");
      invoiceTemplate = await fs.readFile(invoicePath, "utf-8");
    }
    const invoiceFilename = invoiceFile?.name || "invoice.html";

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
        : 0
    };
    const credentials =
      smtpMode === "ses" ? getSesCredentials() : getSendgridCredentials(senderEmail);
    const { client: storageClient, bucket, prefix } = getStorageConfig();
    const storageId = campaignId || `campaign-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const storagePrefix = `${prefix}/${storageId}`;

    const leadsKey = `${storagePrefix}/${path.basename(leadsFilename)}`;
    const bankAccountsKey = `${storagePrefix}/${path.basename(bankFilename)}`;
    const letterKey = `${storagePrefix}/${path.basename(letterFilename)}`;
    const invoiceKey = `${storagePrefix}/${path.basename(invoiceFilename)}`;

    await Promise.all([
      uploadTextObject(
        storageClient,
        bucket,
        leadsKey,
        leadsContent,
        resolveContentType(leadsFilename, "application/json")
      ),
      uploadTextObject(
        storageClient,
        bucket,
        bankAccountsKey,
        bankAccountsContent,
        "application/json"
      ),
      uploadTextObject(
        storageClient,
        bucket,
        letterKey,
        letterTemplate,
        resolveContentType(letterFilename, "text/plain")
      ),
      uploadTextObject(
        storageClient,
        bucket,
        invoiceKey,
        invoiceTemplate,
        resolveContentType(invoiceFilename, "text/html")
      )
    ]);

    const message: CampaignQueueMessage = {
      payloadMode: "s3",
      storage: {
        bucket,
        prefix: storagePrefix,
        leadsKey,
        bankAccountsKey,
        letterKey,
        invoiceKey
      },
      credentials,
      request: requestConfig
    };

    const messageBody = JSON.stringify(message);
    const messageBytes = Buffer.byteLength(messageBody, "utf8");
    if (messageBytes > MAX_SQS_MESSAGE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: "Campaign payload too large",
          error: "SQS message must be under 256 KB; store payload in S3 and send a reference"
        },
        { status: 413 }
      );
    }

    const { client, queueUrl } = getQueueConfig();
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody
      })
    );

    return NextResponse.json({
      success: true,
      message: "Sending in progress",
      campaignId,
      logFilename,
      logDownloadUrl: `/api/campaign-log?filename=${encodeURIComponent(logFilename)}`
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
