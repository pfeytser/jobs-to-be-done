import type { ParsedGmailMessage } from './gmail'

// Renders an email body to PDF locally with Playwright/Chromium. Gmail has no native
// email→PDF export, so when the email *is* the receipt (no PDF attachment) we render
// it ourselves and prepend a provenance header.
//
// Playwright is imported dynamically so the web app bundle never pulls it in — only
// the local worker (and any server path that explicitly calls this) loads it.

export interface RenderHeader {
  accountLabel: string
  from: string
  to: string
  date: string
  subject: string
  messageId: string
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(msg: ParsedGmailMessage, header: RenderHeader): string {
  const provenance = `
    <div style="font-family: -apple-system, Arial, sans-serif; font-size:11px; color:#444;
                border:1px solid #ccc; border-radius:6px; padding:10px 12px; margin:0 0 16px 0;
                background:#f7f7f5;">
      <div style="font-weight:600; margin-bottom:4px;">Receipt captured from Gmail</div>
      <div><b>Account:</b> ${escapeHtml(header.accountLabel)}</div>
      <div><b>From:</b> ${escapeHtml(header.from)}</div>
      <div><b>To:</b> ${escapeHtml(header.to)}</div>
      <div><b>Date:</b> ${escapeHtml(header.date)}</div>
      <div><b>Subject:</b> ${escapeHtml(header.subject)}</div>
      <div><b>Gmail message ID:</b> ${escapeHtml(header.messageId)}</div>
    </div>`

  const body = msg.html
    ? msg.html
    : `<pre style="font-family:-apple-system,Arial,sans-serif; white-space:pre-wrap; font-size:13px;">${escapeHtml(
        msg.text
      )}</pre>`

  return `<!doctype html><html><head><meta charset="utf-8">
    <base href="about:blank">
    <style>body{margin:24px;}</style></head>
    <body>${provenance}${body}</body></html>`
}

export async function renderEmailToPdf(
  msg: ParsedGmailMessage,
  header: RenderHeader
): Promise<Buffer> {
  // Dynamic import keeps Playwright out of the Next.js build.
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    // Block network so remote tracking pixels / external resources don't load or leak.
    await page.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith('data:') || url.startsWith('about:')) return route.continue()
      return route.abort()
    })
    await page.setContent(buildHtml(msg, header), { waitUntil: 'load', timeout: 15_000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
