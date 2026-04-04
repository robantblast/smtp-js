import type { BankAccount, BankAccountsFile, Lead } from "@/lib/types";
import vm from "vm";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeJsExport(content: string) {
  if (content.includes("export default")) {
    return content.replace(/export\s+default/g, "module.exports =");
  }
  return content;
}

function parseJsLeads(content: string, filename: string) {
  const sandbox = {
    module: { exports: {} as unknown },
    exports: {} as unknown
  };

  const script = new vm.Script(normalizeJsExport(content), { filename });
  const context = vm.createContext(sandbox);
  script.runInContext(context, { timeout: 1000 });

  const moduleExports = sandbox.module.exports as any;
  const exportsValue = sandbox.exports as any;
  const exported =
    moduleExports && Object.keys(moduleExports).length > 0 ? moduleExports : exportsValue;

  return exported && exported.default ? exported.default : exported;
}

export function parseLeadsRaw(content: string, filename = "leads.json"): unknown[] {
  const isJs = filename.toLowerCase().endsWith(".js");
  const raw = isJs ? parseJsLeads(content, filename) : JSON.parse(content);

  if (!Array.isArray(raw)) {
    throw new Error("Leads file must export a JSON array");
  }

  return raw;
}

export function getLeadEmailFromRaw(item: unknown): string | null {
  if (typeof item === "string") {
    const trimmed = item.trim();
    return emailRegex.test(trimmed) ? trimmed : null;
  }

  if (typeof item === "object" && item) {
    const rawEmail = (item as { email?: unknown }).email;
    if (typeof rawEmail === "string") {
      const trimmed = rawEmail.trim();
      return emailRegex.test(trimmed) ? trimmed : null;
    }
  }

  return null;
}

export function parseLeads(content: string, filename = "leads.json"): Lead[] {
  const raw = parseLeadsRaw(content, filename);

  const leads: Lead[] = raw
    .map((item) => {
      if (typeof item === "string") {
        return { email: item.trim(), name: item.trim() };
      }

      if (typeof item === "object" && item) {
        const leadItem = item as Record<string, unknown>;
        return {
          email: String(leadItem.email ?? "").trim(),
          name: String(leadItem.name ?? leadItem.email ?? "").trim(),
          title: leadItem.title ?? leadItem.job_title,
          company: leadItem.company_name ?? leadItem.company,
          address: leadItem.address
        };
      }

      return null;
    })
    .filter(Boolean) as Lead[];

  const validLeads = leads.filter((lead) => emailRegex.test(lead.email));
  if (validLeads.length === 0) {
    throw new Error("No valid lead emails found");
  }

  return validLeads;
}

export function parseBankAccounts(content: string): BankAccountsFile {
  const raw = JSON.parse(content) as BankAccountsFile;

  if (!raw || !Array.isArray(raw.accounts)) {
    throw new Error("Bank accounts JSON must include an accounts array");
  }

  const accounts: BankAccount[] = raw.accounts.map((account) => ({
    senderName: account.senderName || "",
    domain: account.domain || "",
    replyToEmail: account.replyToEmail || "",
    emailSubject: account.emailSubject || "FJUWORDZ",
    invoicePrefix: account.invoicePrefix || "$0",
    bankName: account.bankName,
    bankAddress: account.bankAddress,
    bankAddressLine1: account.addressLine1,
    bankAddressLine2: account.addressLine2,
    routingNumber: account.routingNumber,
    acctName: account.acctName,
    acctNumber: account.acctNumber,
    ein: account.ein,
    shola: account.shola,
    companyName: account.companyName
  }));

  if (accounts.length === 0) {
    throw new Error("Bank accounts JSON must include at least one account");
  }

  return { accounts, emailsPerAccount: raw.emailsPerAccount };
}
