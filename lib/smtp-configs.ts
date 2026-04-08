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
    displayName: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false
  },
  {
    name: "ZeptoMail",
    displayName: "Zepto",
    host: "smtp.zeptomail.com",
    port: 587,
    secure: false
  }
];
