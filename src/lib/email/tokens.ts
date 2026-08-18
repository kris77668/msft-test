/**
 * Palette and type, as plain strings for use in email HTML.
 *
 * THE ONE PLACE colour literals may exist outside globals.css, and only because
 * the medium forces it: email clients strip <style> blocks, ignore CSS custom
 * properties, and require inline styles on every element. There is no way to
 * reference `var(--color-mocha)` inside an email.
 *
 * These values MUST stay in sync with src/app/globals.css. If you change the
 * palette there, change it here — `npm run check:contrast` verifies the ratios
 * but cannot see this file.
 */
export const EMAIL = {
  cream: "#faf6ef",
  paper: "#f5ede2",
  mocha: "#3d2e26",
  ink: "#2a201b",
  gold: "#b8956a",
  /** Accessible small-text variants — email body copy is always small text. */
  dustyText: "#8c6960",
  goldText: "#866d4d",

  display: "Georgia,'Times New Roman',serif",
  body: "Helvetica,Arial,sans-serif",
} as const;

/** Eyebrow treatment, matching the `.eyebrow` class on the site. */
export const emailEyebrow = `font-family:${EMAIL.body};font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${EMAIL.dustyText};margin:0 0 24px`;

export const emailBody = `font-family:${EMAIL.body};font-size:14px;line-height:1.7;font-weight:300`;

export const emailButton = `display:inline-block;background:${EMAIL.mocha};color:${EMAIL.cream};text-decoration:none;font-family:${EMAIL.body};font-size:11px;letter-spacing:0.32em;text-transform:uppercase;padding:16px 32px`;
