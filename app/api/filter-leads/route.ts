import { NextRequest, NextResponse } from "next/server";
import type { FilterLeadsResponse } from "@/lib/types";
import { getLeadEmailFromRaw, parseLeadsRaw } from "@/lib/campaign/parsers";

export const runtime = "nodejs";

const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

function parseSentEmails(content: string): string[] {
  const matches = content.match(emailRegex);
  if (!matches) return [];
  return matches.map((value) => value.trim());
}

function buildOutputFilename(filename: string): string {
  const base = filename.replace(/\.(json|js)$/i, "");
  return `${base || "leads"}-unsent.json`;
}

export async function POST(request: NextRequest): Promise<NextResponse<FilterLeadsResponse>> {
  try {
    const formData = await request.formData();
    const leadsFile = formData.get("leads") as File | null;
    const sentLogFile = formData.get("sentLog") as File | null;

    if (!leadsFile || !sentLogFile) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing files",
          error: "leads and sentLog are required"
        },
        { status: 400 }
      );
    }

    const rawLeads = parseLeadsRaw(await leadsFile.text(), leadsFile.name || "leads.json");
    const sentEmails = parseSentEmails(await sentLogFile.text());
    const sentSet = new Set(sentEmails.map((email) => email.toLowerCase()));

    const filteredLeads = rawLeads.filter((item) => {
      const email = getLeadEmailFromRaw(item);
      if (!email) return true;
      return !sentSet.has(email.toLowerCase());
    });

    const removed = rawLeads.length - filteredLeads.length;

    return NextResponse.json({
      success: true,
      message: `Removed ${removed} sent emails`,
      filename: buildOutputFilename(leadsFile.name || "leads.json"),
      summary: {
        total: rawLeads.length,
        removed,
        remaining: filteredLeads.length
      },
      leads: filteredLeads
    });
  } catch (error) {
    console.error("filter-leads failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Filter failed",
        error: message
      },
      { status: 500 }
    );
  }
}
