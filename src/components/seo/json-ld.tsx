/**
 * Renders a schema.org block.
 *
 * `JSON.stringify` output is escaped for `<` so a product name or testimonial
 * containing `</script>` cannot break out of the tag — the standard injection
 * route for user-supplied content in JSON-LD.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
