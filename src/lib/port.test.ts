import { describe, expect, it } from "vitest";
import { MAX_PORT, MIN_PORT, mayReuseExistingServer, parsePort } from "@/lib/port";

const DEFAULT_PORT = 4173;

describe("parsePort", () => {
  it("gives the default port when the setting is not set", () => {
    // Arrange
    const raw = undefined;

    // Act
    const port = parsePort(raw, DEFAULT_PORT);

    // Assert
    expect(port).toBe(DEFAULT_PORT);
  });

  it.each([
    ["4174", 4174],
    ["8080", 8080],
    [String(MIN_PORT), MIN_PORT],
    [String(MAX_PORT), MAX_PORT],
    ["04175", 4175],
  ])("reads %s as the port %i", (raw, expected) => {
    // Arrange
    // (the table above supplies the setting)

    // Act
    const port = parsePort(raw, DEFAULT_PORT);

    // Assert
    expect(port).toBe(expected);
  });

  it("holds the range at the first port above the reserved ones and the last port there is", () => {
    // Arrange
    // (the constants are imported above)

    // Act
    const range = [MIN_PORT, MAX_PORT];

    // Assert
    expect(range).toEqual([1024, 65535]);
  });

  it.each([
    ["an empty string", ""],
    ["text", "abc"],
    ["a decimal", "4173.5"],
    ["a negative number", "-4173"],
    ["a number with a sign", "+4173"],
    ["a number with spaces", " 4173 "],
    ["a hexadecimal number", "0x1000"],
    ["an exponent", "4e3"],
    ["a reserved port", "1023"],
    ["port 0", "0"],
    ["a port that does not exist", "65536"],
    ["a huge number", "99999999999999999999"],
  ])("refuses %s, naming the setting and the rule", (_label, raw) => {
    // Arrange
    // (the table above supplies the setting)

    // Act
    const act = (): number => parsePort(raw, DEFAULT_PORT);

    // Assert
    expect(act).toThrow(`E2E_PORT is ${JSON.stringify(raw)}, but it must be a whole number from 1024 to 65535`);
  });

  it("names another setting when it is given one", () => {
    // Arrange
    const settingName = "PREVIEW_PORT";

    // Act
    const act = (): number => parsePort("nope", DEFAULT_PORT, settingName);

    // Assert
    expect(act).toThrow('PREVIEW_PORT is "nope"');
  });

  it("says which port it uses when the setting is left out", () => {
    // Arrange
    const raw = "nope";

    // Act
    const act = (): number => parsePort(raw, DEFAULT_PORT);

    // Assert
    expect(act).toThrow("Leave it unset to use 4173.");
  });
});

describe("mayReuseExistingServer", () => {
  it("reuses a server that is already running, for a quick local rerun on the default port", () => {
    // Arrange
    const env = {};

    // Act
    const mayReuse = mayReuseExistingServer(env);

    // Assert
    expect(mayReuse).toBe(true);
  });

  it("never reuses a server in CI", () => {
    // Arrange
    const env = { CI: "true" };

    // Act
    const mayReuse = mayReuseExistingServer(env);

    // Assert
    expect(mayReuse).toBe(false);
  });

  it("never reuses a server on a port that E2E_PORT names, so a stale server left there is not tested in place of the fresh build", () => {
    // Arrange
    const env = { E2E_PORT: "4312" };

    // Act
    const mayReuse = mayReuseExistingServer(env);

    // Assert
    expect(mayReuse).toBe(false);
  });
});
