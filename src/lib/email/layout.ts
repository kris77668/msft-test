import { EMAIL, emailBody, emailEyebrow } from "./tokens";

/**
 * The shared email wrapper.
 *
 * Every template previously hand-rolled the same three opening lines — the
 * cream page, the 520px column, the "Ms Fairy Tale" eyebrow — once in
 * `newsletterConfirmEmail` and again inline in `actions/contact.ts`. Two more
 * templates (order and booking confirmation) made that four copies of markup
 * that has to stay visually identical, so it lives here instead.
 *
 * Deliberately NOT `server-only`: these are pure string builders with no
 * network or secret access, which is what lets them be unit-tested under
 * vitest's node environment.
 *
 * Inline styles only. Email clients strip <style> blocks and cannot resolve CSS
 * custom properties, so `var(--color-mocha)` is not available here — values
 * come from ./tokens.ts so the palette still has one source.
 */

export interface EmailShellOptions {
  /** Rendered as the <h1>. Already-escaped HTML is expected. */
  heading: string;
  /** Body markup, already escaped. */
  body: string;
  /** Optional small print below the body, e.g. a "didn't ask for this" note. */
  footnote?: string;
}

export function emailShell({ heading, body, footnote }: EmailShellOptions): string {
  return `
    <div style="font-family:${EMAIL.display};background:${EMAIL.cream};padding:40px 24px;color:${EMAIL.mocha}">
      <div style="max-width:520px;margin:0 auto">
        <p style="${emailEyebrow}">Ms Fairy Tale</p>
        <h1 style="font-size:30px;font-weight:300;margin:0 0 16px">${heading}</h1>
        ${body}
        ${
          footnote
            ? `<p style="${emailBody};font-size:12px;color:${EMAIL.dustyText};margin:32px 0 0">${footnote}</p>`
            : ""
        }
      </div>
    </div>
  `;
}

/**
 * Escapes a value for interpolation into email HTML.
 *
 * Was a private function at the bottom of `actions/contact.ts`. Order and
 * booking confirmations interpolate customer-supplied names too, so it moved
 * here rather than being copied a third time.
 *
 * Escapes the single quote as well as the double: attribute values in these
 * templates are double-quoted today, but a template that ever uses single
 * quotes should not silently become injectable.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A plain-text fallback derived from the HTML.
 *
 * Some clients (and most spam filters) prefer a multipart message. This is a
 * crude strip rather than a real converter — enough to make the message
 * readable, not enough to be worth a dependency.
 */
export function htmlToText(html: string): string {
  return html
    // [\s\S] rather than the `s` flag: tsconfig targets below es2018.
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
