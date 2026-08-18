import { describe, it, expect } from "vitest";
import { emailShell, escapeHtml, htmlToText } from "./layout";
import { orderConfirmationEmail } from "./order-confirmation";
import { bookingConfirmationEmail } from "./booking-confirmation";

describe("escapeHtml", () => {
  it("neutralises tag and attribute breakouts", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(escapeHtml(`" onload="x`)).toBe("&quot; onload=&quot;x");
    expect(escapeHtml("' onload='x")).toBe("&#39; onload=&#39;x");
  });

  it("escapes the ampersand first, so entities are not double-broken", () => {
    expect(escapeHtml("Tom & Jerry <b>")).toBe("Tom &amp; Jerry &lt;b&gt;");
  });
});

describe("htmlToText", () => {
  it("keeps link targets visible", () => {
    expect(htmlToText('<a href="https://example.com">Confirm</a>')).toBe(
      "Confirm (https://example.com)"
    );
  });

  it("strips tags and collapses blank lines", () => {
    expect(htmlToText("<div><p>One</p><p>Two</p></div>")).toBe("One\nTwo");
  });
});

describe("orderConfirmationEmail", () => {
  const base = {
    orderNumber: "MFT-001234",
    firstName: "Eleanor",
    items: [{ name: "Iris", size: "AU 10", qty: 2, unitPriceCents: 240000 }],
    subtotalCents: 480000,
    shippingCents: 0,
    totalCents: 480000,
    gstCents: 43636,
    business: null,
  };

  it("states the order number and the line total", () => {
    const { subject, html } = orderConfirmationEmail(base);

    expect(subject).toContain("MFT-001234");
    expect(html).toContain("Eleanor");
    // 2 x $2,400
    expect(html).toContain("$4,800");
  });

  it("shows the GST component, since prices are GST-inclusive", () => {
    expect(orderConfirmationEmail(base).html).toContain("$436.36");
  });

  /**
   * The reason `business` exists. site_settings.abn is seeded with the literal
   * string 'ABN TO BE CONFIRMED', which is truthy — testing the field directly
   * would print that onto something calling itself a tax invoice.
   */
  it("does not claim to be a tax invoice while the business details are unconfirmed", () => {
    const { html } = orderConfirmationEmail(base);

    expect(html).not.toContain("Tax invoice");
    expect(html).not.toContain("ABN");
    expect(html).toContain("A formal tax invoice will follow");
  });

  it("renders the tax invoice block once real details are supplied", () => {
    const { html } = orderConfirmationEmail({
      ...base,
      business: { legalName: "Ms Fairy Tale Pty Ltd", abn: "12 345 678 901", address: "Sydney NSW" },
    });

    expect(html).toContain("Tax invoice");
    expect(html).toContain("ABN 12 345 678 901");
    expect(html).toContain("Ms Fairy Tale Pty Ltd");
    expect(html).not.toContain("A formal tax invoice will follow");
  });

  it("escapes customer-supplied names", () => {
    const { html } = orderConfirmationEmail({
      ...base,
      firstName: '<img src=x onerror="alert(1)">',
    });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("handles an empty item list without producing broken markup", () => {
    const { html } = orderConfirmationEmail({ ...base, items: [] });

    expect(html).toContain("MFT-001234");
    expect(html).toContain("Total paid");
  });
});

describe("bookingConfirmationEmail", () => {
  const base = {
    firstName: "Sophia",
    whenFormatted: "Tuesday 21 July 2026, 1:00 pm",
    typeLabel: "Bridal consultation",
    depositCents: 10000,
    address: null,
    openingHours: null,
  };

  it("renders the pre-formatted Sydney time verbatim, meridiem included", () => {
    // The template must never reformat a time. The prototype's bare '1:00'
    // meant a customer could book an afternoon fitting and arrive at 1am.
    const { subject, html } = bookingConfirmationEmail(base);

    expect(html).toContain("Tuesday 21 July 2026, 1:00 pm");
    expect(subject).toContain("1:00 pm");
  });

  it("shows the deposit from the data, never a hardcoded figure", () => {
    expect(bookingConfirmationEmail(base).html).toContain("$100");
    expect(bookingConfirmationEmail({ ...base, depositCents: 25000 }).html).toContain("$250");
  });

  it("promises the address separately rather than inventing one", () => {
    const { html } = bookingConfirmationEmail(base);

    expect(html).toContain("send the studio address separately");
    expect(html).not.toContain("Where to find us");
  });

  it("includes the address once it is confirmed", () => {
    const { html } = bookingConfirmationEmail({
      ...base,
      address: "12 Knox Street, Double Bay NSW 2028",
      openingHours: "Tuesday–Saturday",
    });

    expect(html).toContain("Where to find us");
    expect(html).toContain("12 Knox Street");
  });
});

describe("emailShell", () => {
  it("omits the footnote element entirely when there is none", () => {
    const without = emailShell({ heading: "Hello", body: "<p>Body</p>" });
    const withNote = emailShell({ heading: "Hello", body: "<p>Body</p>", footnote: "Note" });

    expect(without).not.toContain("Note");
    expect(withNote).toContain("Note");
  });
});
