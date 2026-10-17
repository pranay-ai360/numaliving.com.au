import { describe, expect, it } from "vitest";
import { site } from "@/config/site";

describe("site contact details", () => {
  it("publishes projects@numaliving.us as the contact email", () => {
    // Arrange / Act
    const { email } = site.contact;

    // Assert
    expect(email).toBe("projects@numaliving.us");
  });
});
