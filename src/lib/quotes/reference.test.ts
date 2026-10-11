import { afterEach, describe, expect, it, vi } from "vitest";
import { createReference } from "./reference";

const REFERENCE_PATTERN = /^NL-[A-HJ-NP-Z2-9]{6}$/;

function bytes(...values: number[]): () => Uint8Array {
  return () => Uint8Array.from(values);
}

describe("createReference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns NL- followed by six characters", () => {
    // Arrange / Act
    const reference = createReference();

    // Assert
    expect(reference).toMatch(REFERENCE_PATTERN);
  });

  it("never uses the easily confused characters I, O, 0 and 1", () => {
    // Arrange
    const references = Array.from({ length: 2000 }, () => createReference());

    // Act
    const confusing = references.filter((reference) => /[IO01]/.test(reference.slice(3)));

    // Assert
    expect(confusing).toEqual([]);
    expect(references.every((reference) => REFERENCE_PATTERN.test(reference))).toBe(true);
  });

  it("returns different references on different calls", () => {
    // Arrange / Act
    const references = new Set(Array.from({ length: 50 }, () => createReference()));

    // Assert
    expect(references.size).toBeGreaterThan(40);
  });

  it("asks the random source for exactly six bytes", () => {
    // Arrange
    const randomBytes = vi.fn(bytes(0, 1, 2, 3, 4, 5));

    // Act
    createReference(randomBytes);

    // Assert
    expect(randomBytes).toHaveBeenCalledExactlyOnceWith(6);
  });

  it("maps random bytes to the alphabet in order", () => {
    expect(createReference(bytes(0, 1, 2, 3, 4, 5))).toBe("NL-ABCDEF");
  });

  it("skips I and O and the digits 0 and 1 in the alphabet", () => {
    // Bytes 7, 8 sit either side of the missing I; 12, 13 either side of the missing O.
    expect(createReference(bytes(7, 8, 12, 13, 24, 31))).toBe("NL-HJNP29");
  });

  it("wraps byte values above 31 evenly around the alphabet", () => {
    // 256 is a multiple of 32, so taking the remainder adds no bias.
    expect(createReference(bytes(32, 63, 64, 255, 128, 224))).toBe("NL-A9A9AA");
  });

  it("draws from crypto.getRandomValues by default", () => {
    // Arrange
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");

    // Act
    createReference();

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    const [argument] = spy.mock.calls[0];
    expect(argument).toBeInstanceOf(Uint8Array);
    expect((argument as Uint8Array).length).toBe(6);
  });
});
