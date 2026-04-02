import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import type { TestSmtpResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<TestSmtpResponse>> {
  try {
    const formData = await request.formData();
    const credentialsRaw = formData.get("credentials") as string | null;

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
      if (!credentials.apiKey) {
        return NextResponse.json(
          { success: false, message: "Missing SendGrid API key", error: "apiKey is required" },
          { status: 400 }
        );
      }

      if (!credentials.fromEmail) {
        return NextResponse.json(
          { success: false, message: "Missing sender email", error: "fromEmail is required" },
          { status: 400 }
        );
      }

      sgMail.setApiKey(credentials.apiKey);

      const testRecipient = credentials.testRecipient || credentials.fromEmail;
      await sgMail.send({
        to: testRecipient,
        from: credentials.fromEmail,
        subject: "SendGrid test",
        text: "This is a SendGrid API test from the SMTP tester.",
        html: "<p>This is a SendGrid API test from the SMTP tester.</p>"
      } as any);
      successMessage = `SendGrid test email sent to ${testRecipient}`;
    } else if (mode === "ses") {
      if (!credentials.fromEmail) {
        return NextResponse.json(
          { success: false, message: "Missing sender email", error: "fromEmail is required" },
          { status: 400 }
        );
      }

      if (!credentials.sesRegion || !credentials.sesAccessKeyId || !credentials.sesSecretAccessKey) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing SES credentials",
            error: "sesRegion, sesAccessKeyId, and sesSecretAccessKey are required"
          },
          { status: 400 }
        );
      }

      const sesClient = new SESClient({
        region: credentials.sesRegion,
        credentials: {
          accessKeyId: credentials.sesAccessKeyId,
          secretAccessKey: credentials.sesSecretAccessKey,
          sessionToken: credentials.sesSessionToken || undefined
        }
      });

      const transporter = nodemailer.createTransport({
        SES: {
          ses: sesClient,
          aws: { SendRawEmailCommand }
        }
      });

      const testRecipient = credentials.testRecipient || credentials.fromEmail;
      await transporter.sendMail({
        from: credentials.fromEmail,
        to: testRecipient,
        subject: "SES test",
        text: "This is a test email from the AWS SES sender."
      });
      successMessage = `SES test email sent to ${testRecipient}`;
    } else {
      if (!credentials.fromEmail) {
        return NextResponse.json(
          { success: false, message: "Missing sender email", error: "fromEmail is required" },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
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

      const testRecipient = credentials.testRecipient || credentials.fromEmail;
      await transporter.sendMail({
        from: credentials.fromEmail,
        to: testRecipient,
        subject: "SMTP test",
        text: "This is a test email from the SMTP tester."
      });
      successMessage = `SMTP test email sent to ${testRecipient}`;
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
