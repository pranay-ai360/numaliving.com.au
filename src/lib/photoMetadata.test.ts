/**
 * Checks the photo metadata scan on synthetic photos: real JPEGs made with sharp, carrying the EXIF and
 * XMP fields the scan looks for, in a throwaway folder. The repository's own photos are never read here.
 */
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp, { type Exif } from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { photoMetadataBlockers, privateMetadataIn, scanPhotos } from "@/lib/photoMetadata";

/** An XMP packet around one description: the attributes sit on the description, the children inside it. */
function xmpPacket(namespaces: string, attributes = "", children = ""): string {
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description ${namespaces} ${attributes}>${children}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

const NS_MM = 'xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"';
const NS_CRS = 'xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"';
const NS_DC = 'xmlns:dc="http://purl.org/dc/elements/1.1/"';

const HISTORY_XMP = xmpPacket(NS_MM, "", "<xmpMM:History><rdf:Seq/></xmpMM:History>");
const CAMERA_RAW_XMP = xmpPacket(NS_CRS, 'crs:Exposure2012="+0.50" crs:Contrast2012="+10"');
const HISTORY_AND_CAMERA_RAW_XMP = xmpPacket(`${NS_MM} ${NS_CRS}`, 'crs:Exposure2012="+1.00"', "<xmpMM:History><rdf:Seq/></xmpMM:History>");
const CREDIT_XMP = xmpPacket(NS_DC, "", "<dc:creator><rdf:Seq><rdf:li>A Photographer</rdf:li></rdf:Seq></dc:creator>");

type PhotoOptions = Readonly<{ exif?: Exif; xmp?: string; orientation?: number }>;

/** A small JPEG with the given metadata, as a camera or Lightroom would have left it. */
async function makePhoto(options: PhotoOptions = {}): Promise<Buffer> {
  let image = sharp({ create: { width: 16, height: 16, channels: 3, background: "#887766" } });
  if (options.orientation !== undefined) image = image.withMetadata({ orientation: options.orientation });
  if (options.exif !== undefined) image = image.withExif(options.exif);
  if (options.xmp !== undefined) image = image.withXmp(options.xmp);
  return image.jpeg().toBuffer();
}

async function metadataOf(options: PhotoOptions) {
  return sharp(await makePhoto(options)).metadata();
}

describe("privateMetadataIn", () => {
  it("finds nothing in a photo without metadata", async () => {
    // Arrange
    const metadata = await metadataOf({});

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual([]);
  });

  it("lets the orientation through: a photo must keep it to display the right way up", async () => {
    // Arrange
    const metadata = await metadataOf({ orientation: 6 });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(metadata.orientation).toBe(6);
    expect(findings).toEqual([]);
  });

  it("finds the camera's serial number", async () => {
    // Arrange
    const metadata = await metadataOf({ exif: { IFD2: { BodySerialNumber: "012345" } } });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["BodySerialNumber"]);
  });

  it("finds the lens's serial number", async () => {
    // Arrange
    const metadata = await metadataOf({ exif: { IFD2: { LensSerialNumber: "98765" } } });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["LensSerialNumber"]);
  });

  it("finds both serial numbers next to the ordinary camera fields, which are not private", async () => {
    // Arrange
    const metadata = await metadataOf({ exif: { IFD0: { Make: "Canon", Model: "EOS R5" }, IFD2: { BodySerialNumber: "012345", LensSerialNumber: "98765" } } });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["BodySerialNumber", "LensSerialNumber"]);
  });

  it("finds a GPS position", async () => {
    // Arrange
    const metadata = await metadataOf({ exif: { IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } } });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["GPS position"]);
  });

  it("does not count the artist and copyright fields: crediting a photographer is a decision for the owner, not a leak", async () => {
    // Arrange
    const metadata = await metadataOf({ exif: { IFD0: { Artist: "A Photographer", Copyright: "A Photographer" } }, xmp: CREDIT_XMP });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(metadata.exif).toBeDefined();
    expect(metadata.xmp).toBeDefined();
    expect(findings).toEqual([]);
  });

  it("finds the edit history in the XMP packet", async () => {
    // Arrange
    const metadata = await metadataOf({ xmp: HISTORY_XMP });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["xmpMM:History"]);
  });

  it("finds Lightroom's Camera Raw settings in the XMP packet", async () => {
    // Arrange
    const metadata = await metadataOf({ xmp: CAMERA_RAW_XMP });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["crs: settings"]);
  });

  it("lists every kind it finds, in a fixed order, once each", async () => {
    // Arrange
    const metadata = await metadataOf({
      exif: { IFD2: { LensSerialNumber: "98765", BodySerialNumber: "012345" }, IFD3: { GPSLatitudeRef: "S" } },
      xmp: HISTORY_AND_CAMERA_RAW_XMP,
    });

    // Act
    const findings = privateMetadataIn(metadata);

    // Assert
    expect(findings).toEqual(["BodySerialNumber", "LensSerialNumber", "GPS position", "xmpMM:History", "crs: settings"]);
  });

  it("reads a big-endian EXIF block the same way", () => {
    // Arrange
    const exif = Buffer.from(
      [
        ...Buffer.from("Exif\0\0", "latin1"),
        0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at 8
        0x00, 0x01, // one entry in IFD0
        0x87, 0x69, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, // Exif IFD pointer -> offset 26
        0x00, 0x00, 0x00, 0x00, // end of IFD0
        0x00, 0x01, // one entry in the Exif IFD
        0xa4, 0x31, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // BodySerialNumber
        0x00, 0x00, 0x00, 0x00,
      ],
    );

    // Act
    const findings = privateMetadataIn({ exif });

    // Assert
    expect(findings).toEqual(["BodySerialNumber"]);
  });

  it.each([
    ["an EXIF block that is only its label", Buffer.from("Exif\0\0", "latin1")],
    ["an EXIF block with no byte order", Buffer.from("Exif\0\0ZZ\x00\x2a\x00\x00\x00\x08", "latin1")],
    ["an EXIF block whose first directory lies beyond its end", Buffer.from("Exif\0\0II\x2a\x00\xff\xff\xff\x7f", "latin1")],
    ["an EXIF block that stops inside an entry", Buffer.from("Exif\0\0II\x2a\x00\x08\x00\x00\x00\x02\x00\x69\x87", "latin1")],
  ])("reports %s as unreadable, so a block it cannot read cannot hide a serial number", (_label, exif) => {
    // Arrange
    // (the table supplies the block)

    // Act
    const findings = privateMetadataIn({ exif });

    // Assert
    expect(findings).toEqual(["unreadable EXIF"]);
  });

  it("does not loop for ever when the EXIF directories point at themselves", () => {
    // Arrange
    const exif = Buffer.from(
      [
        ...Buffer.from("Exif\0\0", "latin1"),
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, IFD0 at 8
        0x01, 0x00, // one entry
        0x69, 0x87, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, // Exif IFD pointer -> IFD0 itself
        0x00, 0x00, 0x00, 0x00,
      ],
    );

    // Act
    const findings = privateMetadataIn({ exif });

    // Assert
    expect(findings).toEqual([]);
  });
});

describe("scanPhotos", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function newRoot(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "numa-metadata-"));
    roots.push(root);
    return root;
  }

  async function put(root: string, file: string, bytes: Buffer | string): Promise<void> {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), bytes);
  }

  it("lists each photo under public/ that carries something private, with what it carries, and leaves the clean ones out", async () => {
    // Arrange
    const root = await newRoot();
    await put(root, "public/projects/alpha/alpha-01.jpg", await makePhoto({ exif: { IFD2: { BodySerialNumber: "012345" } }, xmp: HISTORY_XMP }));
    await put(root, "public/projects/alpha/alpha-02.jpg", await makePhoto({ orientation: 6 }));
    await put(root, "public/og/alpha.jpg", await makePhoto({ xmp: CAMERA_RAW_XMP }));
    await put(root, "public/projects/beta/beta-01.JPEG", await makePhoto({ exif: { IFD3: { GPSLatitudeRef: "N" } } }));

    // Act
    const found = await scanPhotos(root);

    // Assert
    expect(found).toEqual([
      { file: "public/og/alpha.jpg", findings: ["crs: settings"] },
      { file: "public/projects/alpha/alpha-01.jpg", findings: ["BodySerialNumber", "xmpMM:History"] },
      { file: "public/projects/beta/beta-01.JPEG", findings: ["GPS position"] },
    ]);
  });

  it("does not look at the AVIF and WebP copies, which the pipeline writes without metadata", async () => {
    // Arrange
    const root = await newRoot();
    await put(root, "public/projects/alpha/alpha-01-480.avif", "not a real picture");
    await put(root, "public/projects/alpha/alpha-01-480.webp", "not a real picture");
    await put(root, "public/logo.png", "not a real picture");

    // Act
    const found = await scanPhotos(root);

    // Assert
    expect(found).toEqual([]);
  });

  it("finds nothing when there is no public folder", async () => {
    // Arrange
    const root = await newRoot();

    // Act
    const found = await scanPhotos(root);

    // Assert
    expect(found).toEqual([]);
  });

  it("names a .jpg that is not a readable image, rather than skipping it", async () => {
    // Arrange
    const root = await newRoot();
    await put(root, "public/projects/alpha/alpha-01.jpg", "this is not a picture");

    // Act
    const act = scanPhotos(root);

    // Assert
    await expect(act).rejects.toThrow("public/projects/alpha/alpha-01.jpg");
  });

  it("does not follow a symbolic link out of the folder", async () => {
    // Arrange
    const root = await newRoot();
    const outside = await newRoot();
    await put(outside, "secret.jpg", await makePhoto({ exif: { IFD2: { BodySerialNumber: "012345" } } }));
    await mkdir(path.join(root, "public"), { recursive: true });
    await symlink(path.join(outside, "secret.jpg"), path.join(root, "public/linked.jpg"));

    // Act
    const found = await scanPhotos(root);

    // Assert
    expect(found).toEqual([]);
  });
});

describe("photoMetadataBlockers", () => {
  it("makes one blocker for each photo, naming the file, what it carries and what to do", () => {
    // Arrange
    const found = [
      { file: "public/projects/alpha/alpha-01.jpg", findings: ["BodySerialNumber", "xmpMM:History"] as const },
      { file: "public/og/alpha.jpg", findings: ["crs: settings"] as const },
    ];

    // Act
    const blockers = photoMetadataBlockers(found);

    // Assert
    expect(blockers).toEqual([
      "photos.metadata: public/projects/alpha/alpha-01.jpg carries BodySerialNumber, xmpMM:History (strip serial numbers, edit history and camera settings from every published original, keep the orientation)",
      "photos.metadata: public/og/alpha.jpg carries crs: settings (strip serial numbers, edit history and camera settings from every published original, keep the orientation)",
    ]);
  });

  it("lists nothing when no photo carries anything", () => {
    // Arrange
    const found: readonly never[] = [];

    // Act
    const blockers = photoMetadataBlockers(found);

    // Assert
    expect(blockers).toEqual([]);
  });
});
