import { describe, expect, it } from "vitest";
import { BYTES_PER_MB, makePdf, makeRequest } from "./fixtures";
import { buildSubmission } from "./submission";

const REFERENCE = "NL-ABC234";

const FULL_REQUEST = makeRequest({
  company: "Lovelace Interiors",
  phone: "+971 50 000 0000",
  drawingsLink: "https://drive.google.com/drive/folders/abc123",
});

/** The text entries of a FormData, as a plain object. */
function textFields(formData: FormData): Record<string, string> {
  const entries = Array.from(formData.entries()).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value] as const] : [],
  );
  return Object.fromEntries(entries);
}

function fileField(formData: FormData, name: string): File {
  const value = formData.get(name);
  if (!(value instanceof File)) throw new Error(`Expected "${name}" to be a file`);
  return value;
}

describe("buildSubmission", () => {
  describe("the details table", () => {
    it("labels every answer with a human-readable key and adds the FormSubmit options", () => {
      // Arrange / Act
      const formData = buildSubmission(FULL_REQUEST, [], REFERENCE);

      // Assert
      expect(textFields(formData)).toEqual({
        "Full name": "Ada Lovelace",
        Company: "Lovelace Interiors",
        Email: "ada@example.com",
        Phone: "+971 50 000 0000",
        Role: "Architect / designer",
        "Project type": "Residences",
        "Site location": "Dubai, UAE",
        Timeline: "Start within 3 months",
        "Scope and notes": "Walnut wardrobes and vanities for twelve villas.",
        "Drawings link": "https://drive.google.com/drive/folders/abc123",
        "Attached drawings": "None",
        Reference: REFERENCE,
        _subject: "Quote Request NL-ABC234: Residences, Dubai, UAE",
        _template: "table",
        _captcha: "false",
        _replyto: "ada@example.com",
      });
    });

    it("lists the rows in reading order", () => {
      // Arrange / Act
      const keys = Array.from(buildSubmission(FULL_REQUEST, [], REFERENCE).keys());

      // Assert
      expect(keys.filter((key) => !key.startsWith("_"))).toEqual([
        "Full name",
        "Company",
        "Email",
        "Phone",
        "Role",
        "Project type",
        "Site location",
        "Timeline",
        "Scope and notes",
        "Drawings link",
        "Attached drawings",
        "Reference",
      ]);
    });

    it("leaves out Company, Phone and Drawings link when they were not given", () => {
      // Arrange / Act
      const fields = textFields(buildSubmission(makeRequest(), [], REFERENCE));

      // Assert
      expect(fields).not.toHaveProperty("Company");
      expect(fields).not.toHaveProperty("Phone");
      expect(fields).not.toHaveProperty("Drawings link");
    });

    it("leaves out optional fields that are blank strings", () => {
      // Arrange
      const request = makeRequest({ company: "", phone: "  ", drawingsLink: "" });

      // Act
      const fields = textFields(buildSubmission(request, [], REFERENCE));

      // Assert
      expect(fields).not.toHaveProperty("Company");
      expect(fields).not.toHaveProperty("Phone");
      expect(fields).not.toHaveProperty("Drawings link");
    });

    it("keeps line breaks in the scope and notes", () => {
      const request = makeRequest({ message: "Line one\nLine two" });

      expect(textFields(buildSubmission(request, [], REFERENCE))["Scope and notes"]).toBe("Line one\nLine two");
    });

    it("does not add a honeypot field, because filled honeypots are never sent", () => {
      expect(Array.from(buildSubmission(FULL_REQUEST, [], REFERENCE).keys())).not.toContain("_honey");
    });
  });

  describe("the subject", () => {
    it("names the reference, project type and site location", () => {
      const request = makeRequest({ projectType: "Hospitality", location: "Sydney, Australia" });

      expect(textFields(buildSubmission(request, [], REFERENCE))._subject).toBe(
        "Quote Request NL-ABC234: Hospitality, Sydney, Australia",
      );
    });

    it("stays on one line when the location contains line breaks", () => {
      // Arrange
      const request = makeRequest({ location: "Dubai\r\nBcc: attacker@example.com" });

      // Act
      const subject = textFields(buildSubmission(request, [], REFERENCE))._subject;

      // Assert
      expect(subject).toBe("Quote Request NL-ABC234: Residences, Dubai Bcc: attacker@example.com");
      expect(subject).not.toMatch(/[\r\n]/);
    });

    it("is capped at 150 characters and still starts with the reference", () => {
      // Arrange
      const request = makeRequest({ location: "x".repeat(160) });

      // Act
      const subject = textFields(buildSubmission(request, [], REFERENCE))._subject;

      // Assert
      expect(subject).toHaveLength(150);
      expect(subject.startsWith("Quote Request NL-ABC234: Residences, ")).toBe(true);
      expect(subject.endsWith("...")).toBe(true);
    });

    it.each([
      [1, "[1 PDF]"],
      [3, "[3 PDFs]"],
    ])("ends with the number of attached PDFs when there are %d", (count, suffix) => {
      // Arrange
      const files = Array.from({ length: count }, (_, index) => makePdf(`sheet-${index + 1}.pdf`));

      // Act
      const subject = textFields(buildSubmission(FULL_REQUEST, files, REFERENCE))._subject;

      // Assert
      expect(subject).toBe(`Quote Request NL-ABC234: Residences, Dubai, UAE ${suffix}`);
    });

    it("says nothing about PDFs when there are no attachments", () => {
      expect(textFields(buildSubmission(FULL_REQUEST, [], REFERENCE))._subject).not.toMatch(/PDF/);
    });

    it("keeps the PDF count when a long subject is cut to 150 characters", () => {
      // Arrange
      const request = makeRequest({ location: "x".repeat(160) });
      const files = [makePdf("plan.pdf"), makePdf("boq.pdf")];

      // Act
      const subject = textFields(buildSubmission(request, files, REFERENCE))._subject;

      // Assert
      expect(subject).toHaveLength(150);
      expect(subject.startsWith("Quote Request NL-ABC234: Residences, ")).toBe(true);
      expect(subject.endsWith("... [2 PDFs]")).toBe(true);
    });
  });

  describe("attached drawings", () => {
    it("says None when there are no files", () => {
      expect(textFields(buildSubmission(FULL_REQUEST, [], REFERENCE))["Attached drawings"]).toBe("None");
    });

    it("says how many PDFs to expect, then lists each file name with its size", () => {
      // Arrange
      const files = [makePdf("plan.pdf", 2048), makePdf("boq.pdf", 1.5 * BYTES_PER_MB)];

      // Act
      const fields = textFields(buildSubmission(FULL_REQUEST, files, REFERENCE));

      // Assert
      expect(fields["Attached drawings"]).toBe("Expect 2 PDFs attached: plan.pdf (2 KB); boq.pdf (1.5 MB)");
    });

    it("uses the singular for one PDF", () => {
      const fields = textFields(buildSubmission(FULL_REQUEST, [makePdf("plan.pdf", 2048)], REFERENCE));

      expect(fields["Attached drawings"]).toBe("Expect 1 PDF attached: plan.pdf (2 KB)");
    });

    it("prints file names without line breaks or control characters", () => {
      // Arrange
      const files = [makePdf("plan\nBcc: x\u0000.pdf", 1024)];

      // Act
      const fields = textFields(buildSubmission(FULL_REQUEST, files, REFERENCE));

      // Assert
      expect(fields["Attached drawings"]).toBe("Expect 1 PDF attached: plan Bcc: x.pdf (1 KB)");
    });

    it("attaches the first file as attachment, the second as attachment2, and so on", () => {
      // Arrange
      const files = [makePdf("plan.pdf", 2048), makePdf("boq.pdf", 4096), makePdf("detail.pdf", 512)];

      // Act
      const formData = buildSubmission(FULL_REQUEST, files, REFERENCE);

      // Assert
      expect(fileField(formData, "attachment").name).toBe("plan.pdf");
      expect(fileField(formData, "attachment2").name).toBe("boq.pdf");
      expect(fileField(formData, "attachment3").name).toBe("detail.pdf");
      expect(formData.has("attachment4")).toBe(false);
    });

    it("keeps each file's content and type", () => {
      // Arrange
      const files = [makePdf("plan.pdf", 2048)];

      // Act
      const attached = fileField(buildSubmission(FULL_REQUEST, files, REFERENCE), "attachment");

      // Assert
      expect(attached.size).toBe(2048);
      expect(attached.type).toBe("application/pdf");
    });

    it("sends one file per field for a full set of 10", () => {
      // Arrange
      const files = Array.from({ length: 10 }, (_, index) => makePdf(`sheet-${index + 1}.pdf`));

      // Act
      const keys = Array.from(buildSubmission(FULL_REQUEST, files, REFERENCE).keys());

      // Assert
      const attachmentKeys = keys.filter((key) => key.startsWith("attachment"));
      expect(attachmentKeys).toEqual([
        "attachment",
        "attachment2",
        "attachment3",
        "attachment4",
        "attachment5",
        "attachment6",
        "attachment7",
        "attachment8",
        "attachment9",
        "attachment10",
      ]);
    });

    it("adds no attachment fields when there are no files", () => {
      const keys = Array.from(buildSubmission(FULL_REQUEST, [], REFERENCE).keys());

      expect(keys.filter((key) => key.startsWith("attachment"))).toEqual([]);
    });

    it("gives the attached file the same cleaned-up name as the summary", () => {
      // Arrange
      const files = [makePdf("plan\r\nrev B.pdf", 1024)];

      // Act
      const attached = fileField(buildSubmission(FULL_REQUEST, files, REFERENCE), "attachment");

      // Assert
      expect(attached.name).toBe("plan rev B.pdf");
    });
  });

  it("does not modify the request or the list of files it was given", () => {
    // Arrange
    const request = Object.freeze({ ...FULL_REQUEST });
    const files = Object.freeze([makePdf("plan.pdf")]);

    // Act
    const build = () => buildSubmission(request, files, REFERENCE);

    // Assert
    expect(build).not.toThrow();
    expect(request).toEqual(FULL_REQUEST);
    expect(files).toHaveLength(1);
  });
});
