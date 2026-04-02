export interface SmtpConfig {
  name: string;
  displayName?: string;
  host: string;
  port: number;
  secure: boolean;
}

export const SMTP_CONFIGS: SmtpConfig[] = [
  {
    name: "SendGrid",
    displayName: "SG",
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false
  },
  {
    name: "Postmark",
    host: "smtp.postmarkapp.com",
    port: 587,
    secure: false
  },
  {
    name: "Fastmail",
    host: "smtp.fastmail.com",
    port: 587,
    secure: false
  },
  {
    name: "ZeptoMail",
    host: "smtp.zeptomail.com",
    port: 587,
    secure: false
  },
  {
    name: "Custom",
    host: "",
    port: 587,
    secure: false
  }
];
