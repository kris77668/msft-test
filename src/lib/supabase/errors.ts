/**
 * Postgres error codes, named.
 *
 * These SQLSTATE codes were previously scattered as bare string literals across
 * the route handlers (`checkout`, `consultation/hold`, `stripe/webhook`), the
 * admin result mapper and the email ledger. Each one is load-bearing — a
 * unique-violation is how a concurrent duplicate is recognised rather than
 * treated as a failure — so naming them makes the intent greppable and stops a
 * `"23505"` typo from silently changing a race into a 500.
 *
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/** unique_violation — a duplicate lost a race, or a claim already exists. */
export const PG_UNIQUE_VIOLATION = "23505";

/** foreign_key_violation — a referenced row (e.g. a composite (id, kind)) is absent. */
export const PG_FK_VIOLATION = "23503";

/** insufficient_privilege — a column/RLS grant refused the write. */
export const PG_INSUFFICIENT_PRIVILEGE = "42501";
