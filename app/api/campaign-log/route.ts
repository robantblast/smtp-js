import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getLogFilePath, isValidLogFilename } from "@/lib/campaign/logs";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");

    if (!filename || !isValidLogFilename(filename)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid log filename",
          error: "filename is required"
        },
        { status: 400 }
      );
    }

    const filePath = getLogFilePath(filename);
    const fileContents = await fs.readFile(filePath);

    const response = new NextResponse(fileContents);
    response.headers.set("Content-Type", "text/plain; charset=utf-8");
    response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return NextResponse.json(
        {
          success: false,
          message: "Log not found",
          error: "Log file does not exist"
        },
        { status: 404 }
      );
    }

    console.error("campaign-log failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Log download failed",
        error: message
      },
      { status: 500 }
    );
  }
}
