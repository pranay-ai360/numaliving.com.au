#!/usr/bin/env node
/**
 * Serves the static export the way GitHub Pages serves a project site, for local end-to-end tests.
 * Node standard library only.
 *
 *   node scripts/serve-pages.mjs --root out --prefix /numaliving.com.au --port 4173
 *
 * - Only URLs under --prefix are served (the prefix is optional). Everything else, "/" included,
 *   answers 404 with <root>/404.html, as a project site's neighbours would.
 * - A directory URL without a trailing slash gets a 301 to the slash form (the prefix itself too),
 *   and a directory URL with one serves the directory's index.html.
 * - Unknown paths answer 404 with <root>/404.html.
 * - Paths match case-sensitively even on macOS, because GitHub Pages does ("/a.JPG" is not "/a.jpg").
 * - Nothing outside --root is ever served: ".." segments (encoded or not) are refused, and a
 *   symbolic link that leads out of the root is treated as missing.
 * - Only GET and HEAD are allowed, as on a static host.
 */
import { createServer } from "node:http";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const MAX_PORT = 65_535;
const USAGE_ERROR_EXIT_CODE = 2;
const INDEX_FILE = "index.html";
const NOT_FOUND_FILE = "404.html";
const HTML_TYPE = "text/html; charset=utf-8";
const TEXT_TYPE = "text/plain; charset=utf-8";
const DEFAULT_TYPE = "application/octet-stream";
const FALLBACK_NOT_FOUND_PAGE = "<!doctype html><title>404</title><h1>404 Not Found</h1>\n";
const ALLOWED_METHODS = ["GET", "HEAD"];
const STATUS = { ok: 200, movedPermanently: 301, notFound: 404, methodNotAllowed: 405, serverError: 500 };
const USAGE = "Usage: node scripts/serve-pages.mjs --root <dir> [--prefix /repo-name] [--port 4173] [--host 127.0.0.1]";

// GitHub repository names use letters, digits, ".", "_" and "-"; one or more "/name" segments.
const PREFIX_PATTERN = /^(?:\/[\w.~-]+)+$/;

const MIME_TYPES = new Map([
  [".html", HTML_TYPE],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".txt", TEXT_TYPE],
  [".xml", "application/xml; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".pdf", "application/pdf"],
]);

/**
 * @typedef {{ root: string, prefix: string }} ServerConfig
 * @typedef {{ kind: "file", file: string } | { kind: "redirect", location: string } | { kind: "not-found" }} Resolution
 */

/** @type {Resolution} */
const NOT_FOUND = { kind: "not-found" };

/** @param {string} file @returns {string} */
function contentTypeFor(file) {
  return MIME_TYPES.get(path.extname(file).toLowerCase()) ?? DEFAULT_TYPE;
}

/**
 * "" (no prefix) or "/name" without a trailing slash. Throws on anything unsafe to compare paths with.
 * @param {string} raw
 * @returns {string}
 */
function normalizePrefix(raw) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed === "") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!PREFIX_PATTERN.test(withSlash)) {
    throw new Error(`--prefix must look like "/numaliving.com.au" (letters, digits, ".", "_", "-", "~"), but it is ${JSON.stringify(raw)}.`);
  }
  return withSlash;
}

/** @param {string} target @returns {{ rawPath: string, query: string }} */
function splitTarget(target) {
  const queryStart = target.indexOf("?");
  return queryStart === -1
    ? { rawPath: target, query: "" }
    : { rawPath: target.slice(0, queryStart), query: target.slice(queryStart) };
}

/** @param {string} rawPath @returns {string | null} */
function decodePath(rawPath) {
  try {
    const decoded = decodeURIComponent(rawPath);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    // Malformed percent-encoding: no file can match it.
    return null;
  }
}

/** The path below the prefix ("" for the prefix itself), or null when the path is outside it. */
function stripPrefix(/** @type {string} */ decodedPath, /** @type {string} */ prefix) {
  if (prefix === "") return decodedPath;
  if (decodedPath === prefix) return "";
  return decodedPath.startsWith(`${prefix}/`) ? decodedPath.slice(prefix.length) : null;
}

/** Path segments, or null when one of them could climb out of the root. */
function toSegments(/** @type {string} */ inner) {
  const segments = inner.split("/").filter((segment) => segment !== "" && segment !== ".");
  const isUnsafe = segments.some((segment) => segment === ".." || segment.includes("\\"));
  return isUnsafe ? null : segments;
}

/** Exact-case lookup, so a case-insensitive disk (macOS) behaves like GitHub Pages. */
async function hasExactEntry(/** @type {string} */ directory, /** @type {string} */ name) {
  try {
    return (await readdir(directory)).includes(name);
  } catch {
    // Not a directory, or unreadable: the entry is not there as far as the site is concerned.
    return false;
  }
}

/** @param {string} directory @param {readonly string[]} segments @returns {Promise<string | null>} */
async function locate(directory, segments) {
  if (segments.length === 0) return directory;
  const [head, ...rest] = segments;
  return (await hasExactEntry(directory, head)) ? locate(path.join(directory, head), rest) : null;
}

/** True when `candidate`, with symbolic links followed, is the root or inside it. */
async function isInsideRoot(/** @type {string} */ root, /** @type {string} */ candidate) {
  try {
    const real = await realpath(candidate);
    return real === root || real.startsWith(`${root}${path.sep}`);
  } catch {
    // A dangling link or a file that vanished: treat it as missing.
    return false;
  }
}

/** @param {string} location @param {string} query @returns {Resolution} */
function redirectTo(location, query) {
  return { kind: "redirect", location: `${location}${query}` };
}

/** @param {string} prefix @param {readonly string[]} segments @returns {string} */
function directoryUrl(prefix, segments) {
  return `${prefix}/${segments.map((segment) => `${encodeURIComponent(segment)}/`).join("")}`;
}

/** @param {ServerConfig} config @param {string} directory @param {readonly string[]} segments @param {boolean} hasSlash @param {string} query */
async function resolveDirectory(config, directory, segments, hasSlash, query) {
  const index = path.join(directory, INDEX_FILE);
  const hasIndex = (await hasExactEntry(directory, INDEX_FILE)) && (await isInsideRoot(config.root, index));
  if (!hasIndex) return NOT_FOUND;
  return hasSlash ? { kind: "file", file: index } : redirectTo(directoryUrl(config.prefix, segments), query);
}

/**
 * Maps a request target (path and query) to a file to send, a redirect, or "not found".
 * @param {ServerConfig} config
 * @param {string} target
 * @returns {Promise<Resolution>}
 */
async function resolveRequest(config, target) {
  const { rawPath, query } = splitTarget(target);
  const decodedPath = decodePath(rawPath);
  const inner = decodedPath === null ? null : stripPrefix(decodedPath, config.prefix);
  if (inner === null) return NOT_FOUND;
  if (inner === "") return redirectTo(`${config.prefix}/`, query);

  const segments = toSegments(inner);
  const located = segments === null ? null : await locate(config.root, segments);
  if (segments === null || located === null || !(await isInsideRoot(config.root, located))) return NOT_FOUND;

  const hasSlash = inner.endsWith("/");
  const info = await stat(located);
  if (info.isDirectory()) return resolveDirectory(config, located, segments, hasSlash, query);
  return info.isFile() && !hasSlash ? { kind: "file", file: located } : NOT_FOUND;
}

/**
 * @param {import("node:http").ServerResponse} response
 * @param {{ status: number, type: string, body: Buffer | string, isHead: boolean, headers?: Record<string, string> }} reply
 */
function send(response, { status, type, body, isHead, headers = {} }) {
  response.writeHead(status, {
    "Content-Type": type,
    "Content-Length": String(Buffer.byteLength(body)),
    "Cache-Control": "no-cache",
    ...headers,
  });
  response.end(isHead ? undefined : body);
}

/** @param {string} root @returns {Promise<Buffer | string>} */
async function readNotFoundPage(root) {
  try {
    return await readFile(path.join(root, NOT_FOUND_FILE));
  } catch {
    // The export has no 404.html (warned about at startup): answer with a plain page instead.
    return FALLBACK_NOT_FOUND_PAGE;
  }
}

/** @param {ServerConfig} config @param {Resolution} resolution @returns {Promise<{ status: number, type: string, body: Buffer | string, headers?: Record<string, string> }>} */
async function buildReply(config, resolution) {
  if (resolution.kind === "file") {
    return { status: STATUS.ok, type: contentTypeFor(resolution.file), body: await readFile(resolution.file) };
  }
  if (resolution.kind === "redirect") {
    return { status: STATUS.movedPermanently, type: TEXT_TYPE, body: `Moved to ${resolution.location}\n`, headers: { Location: resolution.location } };
  }
  return { status: STATUS.notFound, type: HTML_TYPE, body: await readNotFoundPage(config.root) };
}

/** @param {ServerConfig} config */
function createHandler(config) {
  /** @param {import("node:http").IncomingMessage} request @param {import("node:http").ServerResponse} response */
  return async (request, response) => {
    const method = request.method ?? "GET";
    const isHead = method === "HEAD";
    if (!ALLOWED_METHODS.includes(method)) {
      send(response, { status: STATUS.methodNotAllowed, type: TEXT_TYPE, body: "405 Method Not Allowed\n", isHead, headers: { Allow: ALLOWED_METHODS.join(", ") } });
      return;
    }
    try {
      const reply = await buildReply(config, await resolveRequest(config, request.url ?? "/"));
      send(response, { ...reply, isHead });
    } catch (error) {
      console.error(`serve-pages: ${method} ${request.url} failed:`, error);
      if (!response.headersSent) send(response, { status: STATUS.serverError, type: TEXT_TYPE, body: "500 Internal Server Error\n", isHead });
      else response.destroy();
    }
  };
}

/** @param {string} message @returns {never} */
function exitWithUsageError(message) {
  console.error(`serve-pages: ${message}\n${USAGE}`);
  process.exit(USAGE_ERROR_EXIT_CODE);
}

/** @param {string} text @returns {number} */
function parsePort(text) {
  const port = Number(text);
  if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) exitWithUsageError(`--port must be a whole number from 0 to ${MAX_PORT}, but it is ${JSON.stringify(text)}.`);
  return port;
}

/** @param {string} rawRoot @returns {Promise<string>} */
async function resolveRoot(rawRoot) {
  try {
    const root = await realpath(path.resolve(rawRoot));
    if ((await stat(root)).isDirectory()) return root;
  } catch {
    // Reported below with the path the user gave.
  }
  return exitWithUsageError(`--root ${JSON.stringify(rawRoot)} is not a directory. Build the site first (npm run build:e2e).`);
}

/** @returns {{ root?: string, prefix: string, port: string, host: string }} */
function parseCommandLine() {
  try {
    const { values } = parseArgs({
      options: {
        root: { type: "string" },
        prefix: { type: "string", default: "" },
        port: { type: "string", default: String(DEFAULT_PORT) },
        host: { type: "string", default: DEFAULT_HOST },
      },
      strict: true,
    });
    return values;
  } catch (error) {
    // Unknown flag, or a flag without its value ("--prefix=" passes an empty prefix).
    return exitWithUsageError(error instanceof Error ? error.message : String(error));
  }
}

/** @returns {Promise<ServerConfig & { host: string, port: number }>} */
async function readOptions() {
  const values = parseCommandLine();
  if (values.root === undefined) return exitWithUsageError("--root is required.");
  try {
    const prefix = normalizePrefix(values.prefix);
    return { root: await resolveRoot(values.root), prefix, host: values.host, port: parsePort(values.port) };
  } catch (error) {
    return exitWithUsageError(error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const { root, prefix, host, port } = await readOptions();
  if (!(await hasExactEntry(root, NOT_FOUND_FILE))) console.error(`serve-pages: warning: ${path.join(root, NOT_FOUND_FILE)} is missing; 404s use a plain page.`);

  const server = createServer(createHandler({ root, prefix }));
  server.on("error", (error) => {
    console.error(`serve-pages: cannot serve on ${host}:${port}: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, host, () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address !== null ? address.port : port;
    process.stdout.write(`serve-pages: serving ${root} at http://${host}:${boundPort}${prefix}/\n`);
  });

  const stop = () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

await main();
