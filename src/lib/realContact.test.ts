import { describe, expect, it } from "vitest";
import { formatAddress, isRealAddress, isRealPhoneNumber, isRealStreet, isRealWhatsappNumber, type PostalAddress } from "@/lib/realContact";

describe("isRealPhoneNumber", () => {
  it.each([
    ["a Texas number", "+1 512 555 0100"],
    ["an Australian number", "+61 2 5550 0100"],
    ["a Dubai number", "+971 4 331 2200"],
    ["a number with brackets and dashes", "(512) 555-0147"],
    ["exactly seven digits", "5550147"],
    ["a run of three zeros", "+971 4 300 0147"],
  ])("accepts %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealPhoneNumber(value);

    // Assert
    expect(isReal).toBe(true);
  });

  it.each([
    ["the number the site shipped with", "+971 4 000 0000"],
    ["the same stub with its last digit changed", "+971 4 000 0001"],
    ["a stub written without spaces", "97140000000"],
    ["four zeros in the middle of the digits", "+1 212 0000 555"],
    ["six digits", "555014"],
    ["no digits at all", "call us"],
    ["an empty string", ""],
    ["spaces only", "   "],
  ])("refuses %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealPhoneNumber(value);

    // Assert
    expect(isReal).toBe(false);
  });

  it("counts digits, not characters: formatting does not make a short number long", () => {
    // Arrange
    const value = "+(1) 2-3 4 5 6";

    // Act
    const isReal = isRealPhoneNumber(value);

    // Assert
    expect(isReal).toBe(false);
  });
});

describe("isRealWhatsappNumber", () => {
  it.each([
    ["an Australian number", "61255500100"],
    ["a US number", "15125550147"],
  ])("accepts %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealWhatsappNumber(value);

    // Assert
    expect(isReal).toBe(true);
  });

  it.each([
    ["the number the site shipped with", "971400000000"],
    ["the same stub with its last digit changed", "971400000001"],
    ["a number with a plus sign, which a wa.me link cannot take", "+15125550147"],
    ["a number with spaces", "1 512 555 0147"],
    ["six digits", "555014"],
    ["an empty string", ""],
  ])("refuses %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealWhatsappNumber(value);

    // Assert
    expect(isReal).toBe(false);
  });
});

describe("isRealStreet", () => {
  it.each([
    ["a Dubai street address", "Plot 12, Al Quoz Industrial Area 3"],
    ["a US street address", "1 Example Street"],
    ["an address that starts with the word factory but names a street", "Factory 4, Street 12"],
  ])("accepts %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealStreet(value);

    // Assert
    expect(isReal).toBe(true);
  });

  it.each([
    ["the street the site shipped with", "Factory address"],
    ["the whole stub address pasted into the street", "Factory address, Dubai, UAE"],
    ["the same stub with a full stop", "Factory address, Dubai, UAE."],
    ["the stub in other capitals", "FACTORY ADDRESS, DUBAI, UAE"],
    ["the stub with a number added to it", "Factory address 1"],
    ["a street with no number", "Al Quoz Industrial Area"],
    ["an empty string", ""],
    ["spaces only", "   "],
  ])("refuses %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealStreet(value);

    // Assert
    expect(isReal).toBe(false);
  });
});

const REAL_ADDRESS: PostalAddress = { street: "1 Example Street", locality: "Austin", region: "TX", postalCode: "78701", country: "United States" };
const STUB_ADDRESS: PostalAddress = { street: "Factory address", locality: "Dubai", country: "UAE" };

describe("isRealAddress", () => {
  it.each([
    ["a full US address", REAL_ADDRESS],
    ["an address with no region or postal code", { street: "Plot 12, Al Quoz Industrial Area 3", locality: "Dubai", country: "United Arab Emirates" }],
  ])("accepts %s", (_label, address) => {
    // Arrange
    // (the table supplies the address)

    // Act
    const isReal = isRealAddress(address);

    // Assert
    expect(isReal).toBe(true);
  });

  it.each([
    ["the address the site shipped with", STUB_ADDRESS],
    ["the stub street with a full stop", { ...REAL_ADDRESS, street: "Factory address." }],
    ["an empty street", { ...REAL_ADDRESS, street: "" }],
    ["a street with no number", { ...REAL_ADDRESS, street: "Example Street" }],
    ["an empty city", { ...REAL_ADDRESS, locality: "" }],
    ["a city of spaces", { ...REAL_ADDRESS, locality: "   " }],
    ["an empty country", { ...REAL_ADDRESS, country: "" }],
  ])("refuses %s", (_label, address) => {
    // Arrange
    // (the table supplies the address)

    // Act
    const isReal = isRealAddress(address);

    // Assert
    expect(isReal).toBe(false);
  });
});

describe("formatAddress", () => {
  it("writes the parts on one line, in the order a US reader expects", () => {
    // Arrange
    const address = REAL_ADDRESS;

    // Act
    const line = formatAddress(address);

    // Assert
    expect(line).toBe("1 Example Street, Austin, TX 78701, United States");
  });

  it("leaves out a region and a postal code that are not set", () => {
    // Arrange
    const address: PostalAddress = { street: "Plot 12", locality: "Dubai", country: "United Arab Emirates" };

    // Act
    const line = formatAddress(address);

    // Assert
    expect(line).toBe("Plot 12, Dubai, United Arab Emirates");
  });

  it.each([
    ["a region alone", { region: "TX" }, "1 Example Street, Austin, TX, United States"],
    ["a postal code alone", { postalCode: "78701" }, "1 Example Street, Austin 78701, United States"],
    ["a blank region and postal code", { region: "  ", postalCode: "" }, "1 Example Street, Austin, United States"],
  ])("writes %s", (_label, parts, expected) => {
    // Arrange
    const address: PostalAddress = { street: "1 Example Street", locality: "Austin", country: "United States", ...parts };

    // Act
    const line = formatAddress(address);

    // Assert
    expect(line).toBe(expected);
  });
});
