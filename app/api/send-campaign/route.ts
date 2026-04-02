import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { CampaignRequest, SendCampaignResponse } from "@/lib/types";
import { parseBankAccounts, parseLeads } from "@/lib/campaign/parsers";
import { sendCampaign } from "@/lib/campaign/sender";
import { finishCampaign, startCampaign } from "@/lib/campaign/progress";

export const runtime = "nodejs";

const DEFAULT_SUBJECT_PREFIX = "Fw: ";
const DEFAULT_BODY_SUBJECT_PREFIX = "";
const DEFAULT_INVOICE_FILENAME = "lNVRNUMBER.pdf";
const DEFAULT_LETTER_TIMEZONE = "Australia/Adelaide";
const DEFAULT_ATTACHMENT_TIMEZONE = "America/Los_Angeles";

export async function POST(request: NextRequest): Promise<NextResponse<SendCampaignResponse>> {
  let campaignId: string | undefined;
  let enableStreaming = false;

  try {
    const formData = await request.formData();

    const leadsFile = formData.get("leads") as File | null;
    const bankFile = formData.get("bankAccounts") as File | null;
    const letterFile = formData.get("letter") as File | null;
    const invoiceFile = formData.get("invoiceHtml") as File | null;
    const credentialsRaw = formData.get("credentials") as string | null;

    if (!leadsFile || !bankFile || !letterFile || !credentialsRaw) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required files",
          error: "leads, bankAccounts, letter, and credentials are required"
        },
        { status: 400 }
      );
    }

    const credentials = JSON.parse(credentialsRaw);
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

    const leads = parseLeads(await leadsFile.text(), leadsFile.name || "leads.json");
    const bankAccounts = parseBankAccounts(await bankFile.text());
    const letterTemplate = await letterFile.text();

    let invoiceTemplate = "";
    if (invoiceFile) {
      invoiceTemplate = await invoiceFile.text();
    } else {
      const invoicePath = path.join(process.cwd(), "invoice.html");
      invoiceTemplate = await fs.readFile(invoicePath, "utf-8");
    }

    if (enableStreaming && campaignId) {
      startCampaign(campaignId, leads.length);
    }

    const requestConfig: CampaignRequest = {
      subjectPrefix: String(formData.get("subjectPrefix") || DEFAULT_SUBJECT_PREFIX),
      bodySubjectPrefix: String(formData.get("bodySubjectPrefix") || DEFAULT_BODY_SUBJECT_PREFIX),
      invoiceFilename: String(formData.get("invoiceFilename") || DEFAULT_INVOICE_FILENAME),
      letterTimezone: String(formData.get("letterTimezone") || DEFAULT_LETTER_TIMEZONE),
      attachmentTimezone: String(formData.get("attachmentTimezone") || DEFAULT_ATTACHMENT_TIMEZONE),
      senderEmail: String(formData.get("senderEmail") || "") || undefined,
      invoicePrefix,
      baseDateTime: String(formData.get("baseDateTime") || "") || undefined,
      campaignId,
      enableStreaming,
      emailsPerAccount: formData.get("emailsPerAccount")
        ? Number(formData.get("emailsPerAccount"))
        : undefined,
      chunkSize: formData.get("chunkSize") ? Number(formData.get("chunkSize")) : 50,
      interChunkDelayMs: formData.get("interChunkDelayMs")
        ? Number(formData.get("interChunkDelayMs"))
        : 0
    };

    const summary = await sendCampaign({
      leads,
      bankAccounts,
      letterTemplate,
      invoiceTemplate,
      credentials,
      request: requestConfig
    });

    const failures = summary.failures.map((failure) => ({
      email: failure.email,
      error: failure.error || "Unknown error"
    }));

    if (enableStreaming && campaignId) {
      finishCampaign(campaignId, "completed");
    }

    return NextResponse.json({
      success: summary.failed === 0,
      message:
        summary.failed === 0
          ? `Sent ${summary.sent} emails successfully`
          : `Sent ${summary.sent} emails, ${summary.failed} failed`,
      campaignId,
      summary: {
        sent: summary.sent,
        failed: summary.failed
      },
      failures: failures.length > 0 ? failures.slice(0, 10) : undefined
    });
  } catch (error) {
    console.error("send-campaign failed", error);
    if (enableStreaming && campaignId) {
      finishCampaign(campaignId, "failed");
    }
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
