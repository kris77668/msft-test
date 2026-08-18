/**
 * Minimal class-name joiner. Filters out false/null/undefined so conditional
 * classes read cleanly: clsx("base", isActive && "active").
 *
 * Deliberately not a dependency — this is the entire useful surface of `clsx`.
 */
export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
