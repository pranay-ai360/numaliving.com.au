import { describe, expect, it } from "vitest";
import robots, { dynamic } from "@/app/robots";
import { isIndexable } from "@/config/site";
import { buildRobots } from "@/lib/robots";

describe("robots route", () => {
  it("is generated at build time, which a static export requires", () => {
    // Arrange
    // (the route module is imported above)

    // Act
    const mode = dynamic;

    // Assert
    expect(mode).toBe("force-static");
  });

  it("serves the rules for the site's indexable setting", () => {
    // Arrange
    const expected = buildRobots(isIndexable);

    // Act
    const served = robots();

    // Assert
    expect(served).toEqual(expected);
  });

  it("lets crawlers fetch every page, so they can see the noindex tag while the site is a preview", () => {
    // Arrange
    // (the route reads the site's current setting)

    // Act
    const served = robots();

    // Assert
    expect(served.rules).toEqual({ userAgent: "*", allow: "/" });
  });
});
