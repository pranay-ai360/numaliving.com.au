// Request-only (no browser): checks that scripts/serve-pages.mjs behaves like GitHub Pages, so the
// other specs test the site the way it will really be served.
import { request as sendHttpRequest } from "node:http";
import { expect, test } from "@playwright/test";
import { BASE_PATH, SERVER_HOST, SERVER_ORIGIN, SERVER_PORT } from "./env";

/** Sends the path exactly as written. Playwright and browsers would normalise "..", so they cannot. */
function rawGetStatus(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = sendHttpRequest({ host: SERVER_HOST, port: SERVER_PORT, path, method: "GET" }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on("error", reject);
    request.end();
  });
}

test.skip(({ isMobile }) => isMobile, "Server behaviour does not depend on the screen size.");

test("a directory without its trailing slash is redirected to the slash form", async ({ request }) => {
  const response = await request.get(`${SERVER_ORIGIN}${BASE_PATH}/about`, { maxRedirects: 0 });

  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(`${BASE_PATH}/about/`);
});

test("files are served with their content types, and names match case-sensitively", async ({ request }) => {
  const expectations: readonly (readonly [path: string, contentType: RegExp])[] = [
    ["robots.txt", /^text\/plain/],
    ["icon.svg", /^image\/svg\+xml/],
    ["icon.png", /^image\/png/],
    ["404.html", /^text\/html/],
  ];
  for (const [path, contentType] of expectations) {
    const response = await request.get(path);
    expect.soft(response.status(), path).toBe(200);
    expect.soft(response.headers()["content-type"], path).toMatch(contentType);
  }

  expect((await request.get("ROBOTS.TXT")).status()).toBe(404);
});

test("paths that climb out of the site folder are refused", async () => {
  const attempts = [`${BASE_PATH}/../package.json`, `${BASE_PATH}/%2e%2e/package.json`, `${BASE_PATH}/..%2fpackage.json`];

  for (const path of attempts) {
    expect.soft(await rawGetStatus(path), path).toBe(404);
  }
});

test("only GET and HEAD are allowed", async ({ request }) => {
  expect((await request.head("./")).status()).toBe(200);
  expect((await request.post("./")).status()).toBe(405);
});
