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
    name: "Amazon SES",
    displayName: "AWS SES",
    host: "",
    port: 587,
    secure: false
  }
];
