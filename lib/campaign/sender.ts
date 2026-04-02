import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import { promises as fs } from "fs";
import type { BankAccount, BankAccountsFile, CampaignRequest, Lead, SmtpCredentials } from "@/lib/types";
import { applySubjectTemplate, applyTemplate, buildCatchAllReplyTo, splitNameAndFormatEmail } from "./placeholders";
import {
  applyLegacyDateReplacements,
  resolveBaseDateTime,
  US_EASTERN_TIMEZONE
} from "./date-replacements";
import { recordCampaignEvent } from "./progress";
import { generateInvoiceCode, generateRandomNumber, randomString } from "./random";
import { buildLogFilename, getLogFilePath } from "./logs";
import { generatePdfFromHtml } from "./pdf";

const DEFAULT_CHUNK_SIZE = 50;

function looksLikeHtml(value: string): boolean {
  return /<(html|body|div|p|br|table|tr|td|span|a|strong|em|ul|ol|li|head|style|img|font|center)\b/i.test(
    value
  );
}

async function logSentEmail(
  email: string,
  logFilename?: string,
  leadsFilename?: string
) {
  const filename = logFilename || buildLogFilename(leadsFilename);
  const filePath = getLogFilePath(filename);
  await fs.appendFile(filePath, `${email}\r\n`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBankAccount(accounts: BankAccount[], index: number): BankAccount {
  const accountIndex = index % accounts.length;
  return accounts[accountIndex];
}

function generateInvoiceAmount(prefix: string): string {
  const num3 = generateRandomNumber(1);
  const num4 = generateRandomNumber(1);
  const num5 = generateRandomNumber(1);
  const num6 = generateRandomNumber(1);
  return `${prefix},9${num3}${num4}.${num5}${num6}`;
}

async function readFilename(filename: string, lead: Lead, invoiceCode: string): Promise<string> {
  const domainParts = lead.email.split("@");
  const domain = domainParts[1] || "";
  const baseDomain = domain.split(".")[0] || "";
  const domc = baseDomain ? baseDomain[0].toUpperCase() + baseDomain.slice(1) : "";

  return filename
    .replace(/USER/g, domainParts[0] || "")
    .replace(/DOMC/g, domc)
    .replace(/DOMs/g, baseDomain)
    .replace(/DOMAIN/g, domain)
    .replace(/SILENTCODERSEMAIL/g, lead.email)
    .replace(/RNUMBER/g, invoiceCode);
}

export interface CampaignPayload {
  leads: Lead[];
  bankAccounts: BankAccountsFile;
  letterTemplate: string;
  invoiceTemplate: string;
  credentials: SmtpCredentials;
  request: CampaignRequest;
}

export async function sendCampaign(payload: CampaignPayload) {
  const { leads, bankAccounts, letterTemplate, invoiceTemplate, credentials, request } = payload;
  const emailsPerAccount = request.emailsPerAccount || bankAccounts.emailsPerAccount || 500;
  const chunkSize = request.chunkSize || DEFAULT_CHUNK_SIZE;
  const interChunkDelayMs = request.interChunkDelayMs || 0;
  const baseDate = resolveBaseDateTime(request.baseDateTime, US_EASTERN_TIMEZONE);
  const shouldStream = Boolean(request.enableStreaming && request.campaignId);

  const mode = credentials.mode || "smtp";
  let transporter: nodemailer.Transporter | null = null;

  if (mode === "sendgrid") {
    if (!credentials.apiKey) {
      throw new Error("SendGrid API key is required");
    }
    sgMail.setApiKey(credentials.apiKey);
  } else {
    transporter = nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: {
        user: credentials.username,
        pass: credentials.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();
  }

  const results: Array<{ email: string; status: "success" | "failed"; error?: string }> = [];

  const chunks: Lead[][] = [];
  for (let i = 0; i < leads.length; i += chunkSize) {
    chunks.push(leads.slice(i, i + chunkSize));
  }

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const chunkStartIndex = chunkIndex * chunkSize;

    await Promise.all(
      chunk.map(async (lead, offset) => {
        const emailIndex = chunkStartIndex + offset;
        const accountIndex = Math.floor(emailIndex / emailsPerAccount);
        const bankAccount = getBankAccount(bankAccounts.accounts, accountIndex);

        const randomInitial = randomString(1, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        const senderFullName = (bankAccount.senderName || "").replace(/INITIALS/g, randomInitial);
        const invoiceCode = generateInvoiceCode();
          const prefixSource = request.invoicePrefix || bankAccount.invoicePrefix || "$39,994.05";
          const invoiceAmount = generateInvoiceAmount(prefixSource);

        const { firstName, lastName, formattedEmail, formattedEmail1, formattedEmail2 } =
          splitNameAndFormatEmail(senderFullName, bankAccount.domain || "");

        const dynamicReplyTo = buildCatchAllReplyTo(lead.name, lead.email, bankAccount.replyToEmail || "");
        const subjectBase = applySubjectTemplate(bankAccount.emailSubject || "FJUWORDZ", lead, invoiceCode);
        const subject = `${request.subjectPrefix || ""}${subjectBase}`;
        const bodySubject = `${request.bodySubjectPrefix || ""}${subjectBase}`;

        const letter = await applyTemplate(letterTemplate, {
          lead,
          bankAccount,
          invoiceCode,
          invoiceAmount,
          replyToEmail: dynamicReplyTo,
          senderFullName,
          senderFirstName: firstName,
          senderLastName: lastName,
          formattedEmail,
          formattedEmail1,
          formattedEmail2,
          templateType: "letter",
          timezone: request.letterTimezone || "UTC",
          bodySubject
        });

        const letterWithDates = applyLegacyDateReplacements(
          letter,
          baseDate,
          US_EASTERN_TIMEZONE
        );

        const invoiceHtml = await applyTemplate(invoiceTemplate, {
          lead,
          bankAccount,
          invoiceCode,
          invoiceAmount,
          replyToEmail: dynamicReplyTo,
          senderFullName,
          senderFirstName: firstName,
          senderLastName: lastName,
          formattedEmail,
          formattedEmail1,
          formattedEmail2,
          templateType: "invoice",
          timezone: request.attachmentTimezone || "UTC"
        });

        const invoiceWithDates = applyLegacyDateReplacements(
          invoiceHtml,
          baseDate,
          US_EASTERN_TIMEZONE
        );

        const pdfBuffer = await generatePdfFromHtml(invoiceWithDates);
        const filename = await readFilename(request.invoiceFilename, lead, invoiceCode);

        const senderEmail = request.senderEmail || credentials.fromEmail || credentials.username || "";
        const replyToFallback = credentials.replyTo || senderEmail;
        const replyToAddress = dynamicReplyTo || replyToFallback;
        const isHtml = looksLikeHtml(letterWithDates);

        if (!senderEmail) {
          throw new Error("Sender email is required to send mail");
        }

        try {
          if (mode === "sendgrid") {
            const sgConfig: Record<string, unknown> = {
              to: lead.email,
              from: {
                email: senderEmail,
                name: lead.name
              },
              subject,
              text: letterWithDates,
              html: isHtml ? letterWithDates : undefined,
              attachments: [
                {
                  filename,
                  content: pdfBuffer.toString("base64"),
                  type: "application/pdf",
                  disposition: "attachment"
                }
              ]
            };

            if (replyToAddress) {
              sgConfig.replyTo = {
                email: replyToAddress,
                name: lead.name
              };
            }

            await sgMail.send(sgConfig as any);
          } else if (transporter) {
            const mailConfig = {
              from: `${lead.name} <${senderEmail}>`,
              to: lead.email,
              replyTo: replyToAddress ? `${lead.name} <${replyToAddress}>` : undefined,
              subject,
              text: letterWithDates,
              html: isHtml ? letterWithDates : undefined,
              attachments: [
                {
                  filename,
                  content: pdfBuffer,
                  contentType: "application/pdf"
                }
              ]
            };

            await transporter.sendMail(mailConfig);
          }

          results.push({ email: lead.email, status: "success" });
          await logSentEmail(lead.email, request.logFilename, request.leadsFilename);
          if (shouldStream && request.campaignId) {
            recordCampaignEvent(request.campaignId, {
              email: lead.email,
              status: "success",
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`send-campaign lead failed: ${lead.email}`, error);
          const message = error instanceof Error ? error.message : "Unknown error";
          results.push({ email: lead.email, status: "failed", error: message });
          if (shouldStream && request.campaignId) {
            recordCampaignEvent(request.campaignId, {
              email: lead.email,
              status: "failed",
              error: message,
              timestamp: new Date().toISOString()
            });
          }
        }
      })
    );

    if (chunkIndex < chunks.length - 1 && interChunkDelayMs > 0) {
      await delay(interChunkDelayMs);
    }
  }

  const failures = results.filter((result) => result.status === "failed");

  return {
    sent: results.length - failures.length,
    failed: failures.length,
    failures
  };
}
