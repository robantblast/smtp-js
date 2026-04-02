import { NextRequest, NextResponse } from "next/server";
import type { CampaignStatusResponse } from "@/lib/types";
import { getCampaignStatus } from "@/lib/campaign/progress";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse<CampaignStatusResponse>> {
  try {
    const campaignId = request.nextUrl.searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing campaignId",
          error: "campaignId is required"
        },
        { status: 400 }
      );
    }

    const status = getCampaignStatus(campaignId);

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          message: "Campaign not found",
          error: "No status available for that campaignId"
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign status",
      status
    });
  } catch (error) {
    console.error("campaign-status failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Status lookup failed",
        error: message
      },
      { status: 500 }
    );
  }
}
