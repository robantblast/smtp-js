import { chromium } from "playwright";

export async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
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
