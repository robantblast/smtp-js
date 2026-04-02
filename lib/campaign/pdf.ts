import chromiumAws from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright";

function isAwsRuntime() {
  return Boolean(process.env.AWS_REGION || process.env.AWS_EXECUTION_ENV || process.env.AMPLIFY);
}

async function launchBrowser() {
  if (isAwsRuntime()) {
    const executablePath = await chromiumAws.executablePath();
    return playwrightChromium.launch({
      args: chromiumAws.args,
      executablePath,
      headless: true
    });
  }

  return playwrightChromium.launch({ headless: true });
}

export async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });

  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    printBackground: true,
    preferCSSPageSize: true,
    scale: 1
  });

  await browser.close();
  return pdfBuffer;
}
