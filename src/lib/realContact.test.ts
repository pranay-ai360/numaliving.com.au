import { describe, expect, it } from "vitest";
import { isRealAddress, isRealPhoneNumber, isRealWhatsappNumber } from "@/lib/realContact";

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

describe("isRealAddress", () => {
  it.each([
    ["a Dubai street address", "Plot 12, Al Quoz Industrial Area 3, Dubai, UAE"],
    ["a US street address", "1 Example Street, Austin, TX 78701, USA"],
    ["an address that starts with the word factory but names a street", "Factory 4, Street 12, Dubai"],
  ])("accepts %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealAddress(value);

    // Assert
    expect(isReal).toBe(true);
  });

  it.each([
    ["the address the site shipped with", "Factory address, Dubai, UAE"],
    ["the same stub with a full stop", "Factory address, Dubai, UAE."],
    ["the stub in other capitals", "FACTORY ADDRESS, DUBAI, UAE"],
    ["the stub with a number added to it", "Factory address, Dubai, UAE 1"],
    ["an address with no number", "Dubai, UAE"],
    ["an empty string", ""],
    ["spaces only", "   "],
  ])("refuses %s", (_label, value) => {
    // Arrange
    // (the table supplies the value)

    // Act
    const isReal = isRealAddress(value);

    // Assert
    expect(isReal).toBe(false);
  });
});
