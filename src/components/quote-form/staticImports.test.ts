/**
 * Keeps Zod out of the contact page's own JavaScript. These tests follow the
 * static imports from the Quote Request form and fail if they reach "zod".
 * Dynamic `import()` calls are not followed: they load on demand, in a
 * separate chunk.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FORM_ENTRY = resolve(SRC_DIR, "components/QuoteForm.tsx");
const SOURCE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

// `import x from "y"`, `import "y"` and `export ... from "y"`; type-only imports are erased, so they are skipped.
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;

type ImportGraph = { files: readonly string[]; packages: readonly string[] };

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function isLocal(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("@/");
}

function resolveLocal(specifier: string, fromFile: string): string {
  const base = specifier.startsWith("@/") ? resolve(SRC_DIR, specifier.slice(2)) : resolve(dirname(fromFile), specifier);
  const found = SOURCE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(isFile);
  if (found === undefined) throw new Error(`Cannot resolve "${specifier}" imported by ${fromFile}`);
  return found;
}

function staticImportsOf(file: string): string[] {
  return Array.from(readFileSync(file, "utf8").matchAll(STATIC_IMPORT), (match) => match[1]);
}

/** Every source file and package reached from the queue by static imports. */
function followImports(queue: readonly string[], files: ReadonlySet<string>, packages: ReadonlySet<string>): ImportGraph {
  if (queue.length === 0) return { files: [...files], packages: [...packages] };
  const [file, ...rest] = queue;
  if (files.has(file)) return followImports(rest, files, packages);
  const specifiers = staticImportsOf(file);
  const localFiles = specifiers.filter(isLocal).map((specifier) => resolveLocal(specifier, file));
  const external = specifiers.filter((specifier) => !isLocal(specifier));
  return followImports([...rest, ...localFiles], new Set([...files, file]), new Set([...packages, ...external]));
}

function importGraph(entry: string): ImportGraph {
  return followImports([entry], new Set(), new Set());
}

describe("the Quote Request form's static imports", () => {
  it("never reach Zod, so it is not shipped with the contact page", () => {
    // Arrange / Act
    const graph = importGraph(FORM_ENTRY);

    // Assert
    expect(graph.files).toContain(resolve(SRC_DIR, "lib/quotes/fields.ts"));
    expect(graph.files).not.toContain(resolve(SRC_DIR, "lib/quotes/schema.ts"));
    expect(graph.files).not.toContain(resolve(SRC_DIR, "lib/quotes/submit.ts"));
    expect(graph.packages).not.toContain("zod");
  });

  it("would notice Zod if the form imported the validation code directly", () => {
    // Arrange / Act
    const graph = importGraph(resolve(SRC_DIR, "lib/quotes/submit.ts"));

    // Assert
    expect(graph.packages).toContain("zod");
  });
});
