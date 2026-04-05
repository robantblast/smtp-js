import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import type { TestSmtpResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<TestSmtpResponse>> {
  try {
    const formData = await request.formData();
    const credentialsRaw = formData.get("credentials") as string | null;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sesFromEmail = process.env.SES_FROM_EMAIL;
    const sesRegion = process.env.SES_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    const sesAccessKeyId = process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const sesSecretAccessKey =
      process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const sesSessionToken = process.env.SES_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

    if (!credentialsRaw) {
      return NextResponse.json(
        { success: false, message: "Missing credentials", error: "credentials is required" },
        { status: 400 }
      );
    }

    const credentials = JSON.parse(credentialsRaw);

    const mode = credentials.mode || "smtp";

    let successMessage = "SMTP verified successfully";

    if (mode === "sendgrid") {
      if (!sendgridApiKey) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing SendGrid API key",
            error: "SENDGRID_API_KEY is required"
          },
          { status: 400 }
        );
      }

      const fromEmail = sendgridFromEmail;
      if (!fromEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing sender email",
            error: "SENDGRID_FROM_EMAIL is required"
          },
          { status: 400 }
        );
      }

      sgMail.setApiKey(sendgridApiKey);

      const testRecipient = credentials.testRecipient || fromEmail;
      await sgMail.send({
        to: testRecipient,
        from: fromEmail,
        subject: "SendGrid test",
        text: "This is a SendGrid API test from the SMTP tester.",
        html: "<p>This is a SendGrid API test from the SMTP tester.</p>"
      } as any);
      successMessage = `SendGrid Test Email sent to ${testRecipient}`;
    } else if (mode === "ses") {
      const fromEmail = sesFromEmail;
      if (!fromEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing sender email",
            error: "SES_FROM_EMAIL is required"
          },
          { status: 400 }
        );
      }

      if (!sesRegion || !sesAccessKeyId || !sesSecretAccessKey) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing SES credentials",
            error: "SES_REGION/AWS_REGION, SES_ACCESS_KEY_ID, and SES_SECRET_ACCESS_KEY are required"
          },
          { status: 400 }
        );
      }

      const sesClient = new SESClient({
        region: sesRegion,
        credentials: {
          accessKeyId: sesAccessKeyId,
          secretAccessKey: sesSecretAccessKey,
          sessionToken: sesSessionToken || undefined
        }
      });

      const transporter = nodemailer.createTransport({
        SES: {
          ses: sesClient,
          aws: { SendRawEmailCommand }
        }
      });

      const testRecipient = credentials.testRecipient || fromEmail;
      await transporter.sendMail({
        from: fromEmail,
        to: testRecipient,
        subject: "SES test",
        text: "This is a test email from the AWS SES sender."
      });
      successMessage = `SES test email sent to ${testRecipient}`;
    } else {
      return NextResponse.json(
        { success: false, message: "Unsupported mode", error: "mode must be sendgrid or ses" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: successMessage
    });
  } catch (error) {
    console.error("test-smtp failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, message: "SMTP verification failed", error: message },
      { status: 500 }
    );
  }
}
