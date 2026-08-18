/**
 * Unwrap a PostgREST embedded to-one relation.
 *
 * The shape PostgREST returns for an embedded to-one relation varies by version:
 * sometimes the object, sometimes a single-element array. Rather than each
 * caller re-deriving that (there were three hand-rolled copies —
 * `confirmation/lookup.ts`, `account/page.tsx`, and casts in
 * `stripe/handle-event.ts`), this is the one place that tolerates both.
 *
 * Returns null for an absent relation so callers can `?.` the result.
 */
export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
