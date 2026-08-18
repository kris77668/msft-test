import { describe, it, expect } from "vitest";
import {
  parseFacetParams,
  mergeQuery,
  toSearchParams,
  shouldNoIndex,
} from "./facets";

/**
 * Facet URL parsing and the crawl-budget policy.
 *
 * These are pure functions guarding two documented past bugs: a sort link that
 * silently dropped every active facet (mergeQuery), and faceted URLs flooding
 * the index (shouldNoIndex). Both are asserted here so a refactor can't quietly
 * reintroduce either.
 */

describe("parseFacetParams", () => {
  it("reads a comma-separated facet into a slug list", () => {
    expect(parseFacetParams({ silhouette: "column,mermaid" })).toEqual({
      silhouette: ["column", "mermaid"],
    });
  });

  it("lowercases, trims, and drops empties", () => {
    expect(parseFacetParams({ fabric: " Velvet , ,SILK " })).toEqual({
      fabric: ["velvet", "silk"],
    });
  });

  it("ignores keys that are not known facets", () => {
    expect(parseFacetParams({ sort: "price-asc", nonsense: "x" })).toEqual({});
  });

  it("joins a repeated key (array) the same way a comma list is read", () => {
    expect(parseFacetParams({ neckline: ["v", "sweetheart"] })).toEqual({
      neckline: ["v", "sweetheart"],
    });
  });

  it("drops a key whose values are all empty rather than emitting []", () => {
    expect(parseFacetParams({ occasion: " , " })).toEqual({});
  });
});

describe("mergeQuery", () => {
  it("changes one key while preserving the rest — the sort-keeps-facets bug", () => {
    const current = new URLSearchParams("silhouette=mermaid&fabric=velvet");
    const next = mergeQuery(current, { sort: "price-asc" });
    const parsed = new URLSearchParams(next);
    expect(parsed.get("silhouette")).toBe("mermaid");
    expect(parsed.get("fabric")).toBe("velvet");
    expect(parsed.get("sort")).toBe("price-asc");
  });

  it("removes a key when its value is null", () => {
    const current = new URLSearchParams("sort=new&fabric=silk");
    const next = new URLSearchParams(mergeQuery(current, { sort: null }));
    expect(next.has("sort")).toBe(false);
    expect(next.get("fabric")).toBe("silk");
  });

  it("treats an empty-string value as a removal too", () => {
    const current = new URLSearchParams("sort=new");
    expect(mergeQuery(current, { sort: "" })).toBe("");
  });
});

describe("toSearchParams", () => {
  it("joins repeated keys with a comma, matching parseFacetParams", () => {
    const params = toSearchParams({ silhouette: ["column", "mermaid"], sort: "new" });
    expect(params.get("silhouette")).toBe("column,mermaid");
    expect(params.get("sort")).toBe("new");
  });

  it("skips undefined values", () => {
    const params = toSearchParams({ sort: undefined, fabric: "velvet" });
    expect(params.has("sort")).toBe(false);
    expect(params.get("fabric")).toBe("velvet");
  });
});

describe("shouldNoIndex", () => {
  it("keeps a bare listing indexable", () => {
    expect(shouldNoIndex({})).toBe(false);
  });

  it("keeps a single-facet, single-value page indexable (a real search)", () => {
    expect(shouldNoIndex({ silhouette: ["column"] })).toBe(false);
  });

  it("noindexes two different facets", () => {
    expect(shouldNoIndex({ silhouette: ["column"], fabric: ["velvet"] })).toBe(true);
  });

  it("noindexes multiple values within one facet", () => {
    expect(shouldNoIndex({ silhouette: ["column", "mermaid"] })).toBe(true);
  });
});
