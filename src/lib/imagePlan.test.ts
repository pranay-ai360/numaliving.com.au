import { describe, expect, it } from "vitest";
import {
  DEFAULT_OG_SOURCE,
  OG_SIZE,
  buildManifest,
  compareWithDisk,
  isSourceName,
  planOutputs,
  settingsFingerprint,
  variantPathFor,
  variantWidthsFor,
} from "../../scripts/image-plan.mjs";

type Source = { path: string; width: number; sha256: string };

const GOLF_01: Source = { path: "public/projects/golf-links/golf-links-01.jpg", width: 1600, sha256: "hash-golf-01" };
const GOLF_02: Source = { path: "public/projects/golf-links/golf-links-02.jpg", width: 1000, sha256: "hash-golf-02" };
const SONATE_02: Source = { path: "public/projects/sonate/sonate-02.jpg", width: 1600, sha256: "hash-sonate-02" };

function outputsOf(sources: readonly Source[], options?: { defaultOgSource: string }): readonly string[] {
  return planOutputs(sources, options).map((planned: { output: string }) => planned.output);
}

describe("isSourceName", () => {
  it.each(["golf-links-01.jpg", "penthouse25-07.jpg", "x.jpg", "marina-villa-01.jpg"])("accepts %s", (name) => {
    // Arrange
    // (the table above supplies the name)

    // Act
    const isValid = isSourceName(name);

    // Assert
    expect(isValid).toBe(true);
  });

  it.each([
    "DSC00614.JPG",
    "Marina-View-0001.jpg",
    "golf-links-01.JPG",
    "my photo.jpg",
    "golf_links.jpg",
    "golf-links-01.jpeg",
    "-golf.jpg",
    "golf-.jpg",
    "golf--links.jpg",
    "golf-links.png",
    "golf-links",
  ])("rejects %s, which would break on a case-sensitive server or need URL-encoding", (name) => {
    // Arrange
    // (the table above supplies the name)

    // Act
    const isValid = isSourceName(name);

    // Assert
    expect(isValid).toBe(false);
  });
});

describe("variantPathFor", () => {
  it("writes the variant next to its source, with the width and the format after the name", () => {
    // Arrange
    const source = GOLF_01.path;

    // Act
    const path = variantPathFor(source, 1200, "webp");

    // Assert
    expect(path).toBe("public/projects/golf-links/golf-links-01-1200.webp");
  });
});

describe("planOutputs", () => {
  it("plans an AVIF and a WebP file at every width that fits each photo, never above its own width", () => {
    // Arrange
    const sources = [GOLF_01, GOLF_02];

    // Act
    const outputs = outputsOf(sources, { defaultOgSource: GOLF_01.path }).filter((output) => !output.startsWith("public/og/"));

    // Assert
    expect(outputs).toEqual([
      ...[480, 800, 1200, 1600].flatMap((width) => ["avif", "webp"].map((format) => `public/projects/golf-links/golf-links-01-${width}.${format}`)),
      ...[480, 800].flatMap((width) => ["avif", "webp"].map((format) => `public/projects/golf-links/golf-links-02-${width}.${format}`)),
    ]);
  });

  it("plans a share image for each project, cut from the project's first photo, and one default", () => {
    // Arrange
    const sources = [GOLF_01, GOLF_02, SONATE_02];

    // Act
    const planned = planOutputs(sources, { defaultOgSource: GOLF_01.path }).filter((entry: { kind: string }) => entry.kind === "og");

    // Assert
    expect(planned).toEqual([
      { output: "public/og/golf-links.jpg", source: GOLF_01.path, kind: "og" },
      { output: "public/og/default.jpg", source: GOLF_01.path, kind: "og" },
    ]);
  });

  it("cuts the default share image from the source it is told to", () => {
    // Arrange
    const sources = [GOLF_01, SONATE_02];

    // Act
    const planned = planOutputs(sources, { defaultOgSource: SONATE_02.path });

    // Assert
    expect(planned.find((entry: { output: string }) => entry.output === "public/og/default.jpg")?.source).toBe(SONATE_02.path);
  });

  it("plans no share image for a project whose first photo is missing", () => {
    // Arrange
    const sources = [SONATE_02, GOLF_01];

    // Act
    const outputs = outputsOf(sources, { defaultOgSource: GOLF_01.path });

    // Assert
    expect(outputs).not.toContain("public/og/sonate.jpg");
  });

  it("fails with a plain message when the default share image's source is not among the photos", () => {
    // Arrange
    const sources = [GOLF_01];

    // Act
    const act = (): unknown => planOutputs(sources, { defaultOgSource: "public/projects/nowhere/nowhere-01.jpg" });

    // Assert
    expect(act).toThrow("nowhere-01.jpg");
  });

  it("uses the marina villa's first photo for the default share image unless told otherwise", () => {
    // Arrange
    const source: Source = { path: DEFAULT_OG_SOURCE, width: 1600, sha256: "hash" };

    // Act
    const planned = planOutputs([source]);

    // Assert
    expect(planned.find((entry: { output: string }) => entry.output === "public/og/default.jpg")?.source).toBe(DEFAULT_OG_SOURCE);
  });

  it("sizes every share image 1200 x 630", () => {
    // Arrange
    const size = OG_SIZE;

    // Act
    const { width, height } = size;

    // Assert
    expect([width, height]).toEqual([1200, 630]);
  });

  it("lists the same outputs however the photos are ordered", () => {
    // Arrange
    const forward = [GOLF_01, GOLF_02, SONATE_02];
    const backward = [SONATE_02, GOLF_02, GOLF_01];
    const options = { defaultOgSource: GOLF_01.path };

    // Act
    const [first, second] = [outputsOf(forward, options), outputsOf(backward, options)];

    // Assert
    expect(second).toEqual(first);
  });
});

describe("variantWidthsFor", () => {
  it("offers the standard widths that fit the photo", () => {
    // Arrange
    const photoWidth = 1000;

    // Act
    const widths = variantWidthsFor(photoWidth);

    // Assert
    expect(widths).toEqual([480, 800]);
  });
});

describe("buildManifest", () => {
  it("records each photo's hash, and a fingerprint of the encoder settings, in a fixed order", () => {
    // Arrange
    const sources = [SONATE_02, GOLF_01];

    // Act
    const manifest = buildManifest(sources);

    // Assert
    expect(manifest).toEqual({
      settings: settingsFingerprint(),
      sources: { [GOLF_01.path]: "hash-golf-01", [SONATE_02.path]: "hash-sonate-02" },
    });
    expect(Object.keys(manifest.sources)).toEqual([GOLF_01.path, SONATE_02.path]);
  });
});

describe("settingsFingerprint", () => {
  it("is the same on every call, so an unchanged setup never looks out of date", () => {
    // Arrange
    const first = settingsFingerprint();

    // Act
    const second = settingsFingerprint();

    // Assert
    expect(second).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("compareWithDisk", () => {
  const SOURCES = [GOLF_01, GOLF_02];
  const OPTIONS = { defaultOgSource: GOLF_01.path };
  const planned = planOutputs(SOURCES, OPTIONS);
  const expected = buildManifest(SOURCES);
  const everything = planned.map((entry) => entry.output);

  it("finds nothing to do when every planned file exists and the record matches the photos", () => {
    // Arrange
    const disk = { recorded: expected, existing: everything };

    // Act
    const result = compareWithDisk({ planned, expected, ...disk });

    // Assert
    expect(result).toEqual({ missing: [], stale: [], orphaned: [] });
  });

  it("names a planned file that is not on disk", () => {
    // Arrange
    const existing = everything.filter((file) => file !== "public/projects/golf-links/golf-links-02-800.avif");

    // Act
    const result = compareWithDisk({ planned, expected, recorded: expected, existing });

    // Assert
    expect(result.missing).toEqual(["public/projects/golf-links/golf-links-02-800.avif"]);
    expect(result.stale).toEqual([]);
  });

  it("names every file of a photo that changed since its files were made", () => {
    // Arrange
    const recorded = { ...expected, sources: { ...expected.sources, [GOLF_02.path]: "an-older-hash" } };

    // Act
    const result = compareWithDisk({ planned, expected, recorded, existing: everything });

    // Assert
    expect(result.stale).toEqual(
      planned.filter((entry) => entry.source === GOLF_02.path).map((entry) => entry.output),
    );
  });

  it("names every file when the encoder settings changed", () => {
    // Arrange
    const recorded = { ...expected, settings: "settings-from-an-older-version" };

    // Act
    const result = compareWithDisk({ planned, expected, recorded, existing: everything });

    // Assert
    expect(result.stale).toEqual(everything);
  });

  it("names every file when nothing has been recorded yet", () => {
    // Arrange
    const recorded = null;

    // Act
    const result = compareWithDisk({ planned, expected, recorded, existing: everything });

    // Assert
    expect(result.stale).toEqual(everything);
  });

  it("names a generated file that no photo asks for any more, such as the variants of a renamed photo", () => {
    // Arrange
    const existing = [...everything, "public/projects/golf-links/old-name-800.avif", "public/og/removed.jpg"];

    // Act
    const result = compareWithDisk({ planned, expected, recorded: expected, existing });

    // Assert
    expect(result.orphaned).toEqual(["public/projects/golf-links/old-name-800.avif", "public/og/removed.jpg"]);
  });
});
