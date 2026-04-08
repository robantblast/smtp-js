import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import type { TestSmtpResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<TestSmtpResponse>> {
  try {
    const formData = await request.formData();
    const credentialsRaw = formData.get("credentials") as string | null;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const zeptomailToken = process.env.ZEPTOMAIL_TOKEN;
    const zeptomailFromEmail = process.env.ZEPTOMAIL_FROM_EMAIL;

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
    } else if (mode === "zeptomail") {
      if (!zeptomailToken) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing ZeptoMail token",
            error: "ZEPTOMAIL_TOKEN is required"
          },
          { status: 400 }
        );
      }

      const fromEmail = zeptomailFromEmail;
      if (!fromEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing sender email",
            error: "ZEPTOMAIL_FROM_EMAIL is required"
          },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.zeptomail.com",
        port: 587,
        secure: false,
        auth: {
          user: "emailapikey",
          pass: zeptomailToken
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.verify();

      const testRecipient = credentials.testRecipient || fromEmail;
      await transporter.sendMail({
        from: fromEmail,
        to: testRecipient,
        subject: "ZeptoMail test",
        text: "This is a test email from ZeptoMail SMTP."
      });
      successMessage = `ZeptoMail test email sent to ${testRecipient}`;
    } else {
      return NextResponse.json(
        { success: false, message: "Unsupported mode", error: "mode must be sendgrid or zeptomail" },
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
