import type { BankAccount, Lead } from "@/lib/types";
import { generateRandomNumber, randomString } from "./random";
import { timezoneSet } from "./time";
import { generateFjuwordzSubject } from "./fjuwordz";

export function formatShola(value?: string): string {
  if (!value || value.length !== 9) return value || "";
  return `${value.slice(0, 3)} ${value.slice(3, 5)} ${value.slice(5)}`;
}

export function formatEin(value?: string): string {
  if (!value || value.length !== 9) return value || "";
  return `${value.slice(0, 2)} ${value.slice(2)}`;
}

export function createSignature(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}.${parts[parts.length - 1]}`;
}

function toTitleCase(value: string): string {
  if (!value) return value;
  return value
    .split(/\s+/)
    .map((token) => {
      if (!token) return token;
      const leading = token.match(/^[^A-Za-z0-9]+/)?.[0] || "";
      const trailing = token.match(/[^A-Za-z0-9]+$/)?.[0] || "";
      const core = token.slice(leading.length, token.length - trailing.length);

      if (!core) return token;
      if (/^\d+$/.test(core)) return token;
      if (core.includes(".")) {
        return `${leading}${core.toUpperCase()}${trailing}`;
      }
      if (/^[A-Z]{1,2}$/.test(core)) {
        return `${leading}${core.toUpperCase()}${trailing}`;
      }

      const lower = core.toLowerCase();
      return `${leading}${lower.charAt(0).toUpperCase()}${lower.slice(1)}${trailing}`;
    })
    .join(" ");
}

export function splitNameAndFormatEmail(fullName: string, domain: string) {
  const [firstName = "", lastName = ""] = fullName.split(" ");
  const formattedEmail = `${firstName}.${lastName}@${domain}`;
  const formattedEmail1 = `${firstName}.${lastName.toLowerCase()}@${domain}`;
  const formattedEmail2 = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
  return { firstName, lastName, formattedEmail, formattedEmail1, formattedEmail2 };
}

export function buildCatchAllReplyTo(leadFullName: string, leadEmail: string, replyToTemplate: string) {
  const rawFirst = leadFullName.trim().split(/\s+/)[0] || "";
  const firstLower = rawFirst.toLowerCase();
  const firstCaps = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
  const domainBase = (leadEmail.split("@")[1] || "").split(".")[0] || "";

  let result = replyToTemplate.replace(/LDFNAMECAPS/g, firstCaps);
  result = result.replace(/LDFNAME/g, firstLower);
  result = result.replace(/DOMs/g, domainBase);
  return result;
}

export function resolveSubjectTemplate(subject: string): string {
  if (subject.includes("FJUWORDZ")) {
    return subject.replace(/FJUWORDZ/g, generateFjuwordzSubject());
  }
  return subject;
}

export function applySubjectTemplate(subject: string, lead: Lead, invoiceCode: string): string {
  const { userPart, domainPart, baseDomain, domc } = resolveDomainParts(lead.email);
  let result = resolveSubjectTemplate(subject);

  result = result.replace(/USER/g, userPart);
  result = result.replace(/DOMAIN/g, domainPart);
  result = result.replace(/RNUMBER/g, invoiceCode);
  result = result.replace(/DOMC/g, domc);
  result = result.replace(/DOMs/g, baseDomain);
  result = result.replace(/OGA/g, lead.name);
  result = result.replace(/SILENTCODERSEMAIL/g, lead.email);
  result = result.replace(/SILENTCODERSLIMAHURUF/g, randomString(5, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  result = result.replace(/SILENTCODERSBANYAKHURUF/g, randomString(50, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  result = result.replace(/TITLE/g, lead.title || "");
  result = result.replace(/ILEISE/g, lead.company || "");

  return result;
}

async function lookupCompanyName(domain: string, fallback: string): Promise<string> {
  try {
    const response = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${domain}`
    );
    const data = (await response.json()) as Array<{ name?: string }>;
    if (data && data.length > 0 && data[0].name) {
      return data[0].name;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function resolveDomainParts(email: string) {
  const [userPart = "", domainPart = ""] = email.split("@");
  const baseDomain = domainPart.split(".")[0] || "";
  const domc = baseDomain ? baseDomain[0].toUpperCase() + baseDomain.slice(1) : "";
  return { userPart, domainPart, baseDomain, domc };
}

export interface TemplateContext {
  lead: Lead;
  bankAccount: BankAccount;
  invoiceCode: string;
  invoiceAmount: string;
  replyToEmail: string;
  senderFullName: string;
  senderFirstName: string;
  senderLastName: string;
  formattedEmail: string;
  formattedEmail1: string;
  formattedEmail2: string;
  templateType: "letter" | "invoice";
  timezone: string;
  bodySubject?: string;
  addressLine1?: string;
  addressLine2?: string;
}

export async function applyTemplate(template: string, context: TemplateContext): Promise<string> {
  const { lead, bankAccount } = context;
  const { userPart, domainPart, baseDomain, domc } = resolveDomainParts(lead.email);

  let result = template;

  result = result.replace(/HOUR24/g, timezoneSet(context.timezone, "H"));
  result = result.replace(/HOUR12/g, timezoneSet(context.timezone, "h"));
  result = result.replace(/MINUTE/g, timezoneSet(context.timezone, "i"));
  result = result.replace(/SECONDS/g, timezoneSet(context.timezone, "s"));
  result = result.replace(/DAY/g, timezoneSet(context.timezone, "d"));
  result = result.replace(/MONTH/g, timezoneSet(context.timezone, "m"));
  result = result.replace(/YEAR/g, timezoneSet(context.timezone, "Y"));
  result = result.replace(/FULLDATE1/g, timezoneSet(context.timezone, "full"));
  result = result.replace(/FULLDATE2/g, timezoneSet(context.timezone, "full2"));
  result = result.replace(/JDATE/g, timezoneSet(context.timezone, "jdate"));
  result = result.replace(/JDATE2/g, timezoneSet(context.timezone, "jdate2"));
  result = result.replace(/FULLTIME24/g, timezoneSet(context.timezone, "fulltime24"));
  result = result.replace(/FULLTIME12/g, timezoneSet(context.timezone, "fulltime12"));

  result = result.replace(/RNUMBER/g, context.invoiceCode);
  result = result.replace(/SILENTCODERSEMAIL/g, lead.email);
  result = result.replace(/EMAILURLSILENTC0DERS/g, Buffer.from(lead.email).toString("base64"));
  result = result.replace(/SILENTCODERSLIMAHURUF/g, randomString(5, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  result = result.replace(/SILENTCODERSBANYAKHURUF/g, randomString(50, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  result = result.replace(/USER/g, userPart);
  result = result.replace(/DOMAIN/g, domainPart);
  result = result.replace(/DOMC/g, domc);
  result = result.replace(/DOMs/g, baseDomain);
  result = result.replace(/BOSS/g, lead.name);
  result = result.replace(/OGA/g, lead.name);

  const companyName = await lookupCompanyName(domainPart, domc);
  result = result.replace(/COMPANYNAME/g, companyName);

  const hasCompanyName = Boolean(bankAccount.companyName && bankAccount.companyName.trim());
  if (hasCompanyName && context.templateType !== "letter") {
    result = result.replace(/FLNAME/g, "");
    result = result.replace(/FLCAPSNAME/g, "");
    result = result.replace(/BUSINESSNAME/g, bankAccount.companyName || "");
    result = result.replace(/BUSINESSCAPSNAME/g, (bankAccount.companyName || "").toUpperCase());
  } else {
    result = result.replace(/FLNAME/g, context.senderFullName);
    result = result.replace(/FLCAPSNAME/g, `${context.senderFirstName} ${context.senderLastName}`.toUpperCase());

    if (hasCompanyName && context.templateType === "letter") {
      result = result.replace(/BUSINESSNAME/g, bankAccount.companyName || "");
      result = result.replace(/BUSINESSCAPSNAME/g, (bankAccount.companyName || "").toUpperCase());
    } else {
      result = result.replace(/BUSINESSNAME/g, "");
      result = result.replace(/BUSINESSCAPSNAME/g, "");
    }
  }

  result = result.replace(/FNNAME/g, context.senderFirstName);
  result = result.replace(/REPLYTO1/g, context.formattedEmail1);
  result = result.replace(/REPLYTO2/g, context.formattedEmail2);
  result = result.replace(/REPLYTO/g, context.formattedEmail);

  const leadFirst = lead.name.trim().split(/\s+/)[0] || "";
  const leadCaps = leadFirst.charAt(0).toUpperCase() + leadFirst.slice(1).toLowerCase();
  const leadLower = leadFirst.toLowerCase();
  result = result.replace(/LDFNAMECAPS/g, leadCaps);
  result = result.replace(/LDFNAME/g, leadLower);

  result = result.replace(/RP2EMAIL/g, context.replyToEmail);
  result = result.replace(/SENDERNAME/g, (bankAccount.senderName || "").toUpperCase());
  result = result.replace(/SIGNATURE/g, createSignature(lead.name || ""));
  result = result.replace(/SHOLA/g, formatShola(bankAccount.shola));
  result = result.replace(/EINDATA/g, formatEin(bankAccount.ein));

  const defaultAddressLine1 = "5060 CALIFORNIA AVENUE";
  const defaultAddressLine2 = "BAKERSFIELD, CA 93309";

  const bankAddress = bankAccount.bankAddress || "";
  const addressLine1 = context.addressLine1 || defaultAddressLine1;
  const addressLine2 = context.addressLine2 || defaultAddressLine2;
  const resolvedAddressLine1 = addressLine1 || defaultAddressLine1;
  const resolvedAddressLine2 = addressLine2 || defaultAddressLine2;
  const titleAddressLine1 = toTitleCase(resolvedAddressLine1);
  const titleAddressLine2 = toTitleCase(resolvedAddressLine2);

  result = result.replace(/BANKNAME/g, bankAccount.bankName || "");
  result = result.replace(/BANKADDRESS/g, bankAddress);
  result = result.replace(/SMALLADRSINVOICEONE/g, resolvedAddressLine1);
  result = result.replace(/SMALLADRSINVOICETWO/g, resolvedAddressLine2);

  result = result.replace(/TITLEADRSINVOICEONE/g, titleAddressLine1);
  result = result.replace(/TITLEADRSINVOICETWO/g, titleAddressLine2);
  result = result.replace(/ROUTINGNUMBER/g, bankAccount.routingNumber || "");
  result = result.replace(/ACCTNAME/g, bankAccount.acctName || "");
  result = result.replace(/ACCTNUMBER/g, bankAccount.acctNumber || "");

  result = result.replace(/INVAMT/g, context.invoiceAmount);

  result = result.replace(/\{\{NUM\}\}/g, String(Math.floor(Math.random() * 6) + 1));
  for (let i = 2; i <= 12; i += 1) {
    const token = new RegExp(`\\{\\{NUM${i}\\}\\}`, "g");
    result = result.replace(token, generateRandomNumber(1));
  }

  if (context.bodySubject) {
    result = result.replace(/SUBJECT/g, context.bodySubject);
  }

  return result;
}
