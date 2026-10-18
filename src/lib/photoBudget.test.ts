import { describe, expect, it } from "vitest";
import { firstViewCopies, pickCandidate, slotWidth } from "@/lib/photoBudget";

const SIZES = "(min-width: 1280px) 390px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
const SRC_SET = "/a-480.avif 480w, /a-800.avif 800w, /a-1200.avif 1200w, /a-1600.avif 1600w";

describe("slotWidth", () => {
  it.each([
    [1440, 390],
    [1280, 390],
    [1100, 363],
    [1024, 337.92],
    [800, 400],
    [640, 320],
    [390, 390],
  ])("works out the slot at a screen %i px wide: %d px", (screenWidth, expected) => {
    // Arrange
    // (the table above supplies the screen)

    // Act
    const width = slotWidth(SIZES, screenWidth);

    // Assert
    expect(width).toBeCloseTo(expected, 5);
  });

  it("reads a plain length with no condition, such as the whole width", () => {
    // Arrange
    const sizes = "100vw";

    // Act
    const width = slotWidth(sizes, 390);

    // Assert
    expect(width).toBe(390);
  });

  it.each(["calc(100vw - 2rem)", "(min-width: 600px) 50%, 100vw", "(max-width: 600px) 100vw, 50vw"])("refuses %s, which it cannot work out, instead of guessing", (sizes) => {
    // Arrange
    // (the table above supplies the sizes)

    // Act
    const act = (): number => slotWidth(sizes, 390);

    // Assert
    expect(act).toThrow(/px and vw|plain length/);
  });

  it("refuses sizes that end with a condition, because the browser needs a fallback", () => {
    // Arrange
    const sizes = "(min-width: 1000px) 50vw";

    // Act
    const act = (): number => slotWidth(sizes, 390);

    // Assert
    expect(act).toThrow("plain length");
  });
});

describe("pickCandidate", () => {
  it.each([
    [100, "/a-480.avif"],
    [480, "/a-480.avif"],
    [481, "/a-800.avif"],
    [1170, "/a-1200.avif"],
    [1600, "/a-1600.avif"],
    [3000, "/a-1600.avif"],
  ])("takes the narrowest copy that is wide enough for %i px, or the widest there is: %s", (wantedWidth, expected) => {
    // Arrange
    // (the table above supplies the width)

    // Act
    const url = pickCandidate(SRC_SET, wantedWidth);

    // Assert
    expect(url).toBe(expected);
  });

  it("does not depend on the order the copies are listed in", () => {
    // Arrange
    const shuffled = "/a-1600.avif 1600w, /a-480.avif 480w, /a-1200.avif 1200w, /a-800.avif 800w";

    // Act
    const url = pickCandidate(shuffled, 700);

    // Assert
    expect(url).toBe("/a-800.avif");
  });

  it("refuses a srcset that is not written in widths", () => {
    // Arrange
    const srcSet = "/a-480.avif 1x, /a-800.avif 2x";

    // Act
    const act = (): string => pickCandidate(srcSet, 500);

    // Assert
    expect(act).toThrow(/width descriptor/);
  });
});

function pictureHtml(name: string): string {
  return `<picture>
    <source type="image/avif" srcset="/${name}-480.avif 480w, /${name}-800.avif 800w" sizes="100vw">
    <source type="image/webp" srcset="/${name}-480.webp 480w, /${name}-800.webp 800w" sizes="100vw">
    <img src="/${name}.jpg" alt="">
  </picture>`;
}

function pageWith(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("firstViewCopies", () => {
  const PHONE = { width: 390, density: 3 };

  it("takes the AVIF copy the screen would pick for each picture", () => {
    // Arrange
    const page = pageWith(pictureHtml("one") + pictureHtml("two"));

    // Act
    const copies = firstViewCopies(page, PHONE);

    // Assert
    expect(copies).toEqual(["/one-800.avif", "/two-800.avif"]);
  });

  it("leaves out the pictures inside a closed details element, which the browser does not fetch", () => {
    // Arrange
    const page = pageWith(pictureHtml("shown") + `<details>${pictureHtml("hidden")}</details>`);

    // Act
    const copies = firstViewCopies(page, PHONE);

    // Assert
    expect(copies).toEqual(["/shown-800.avif"]);
  });

  it("counts the pictures inside a details element that is open", () => {
    // Arrange
    const page = pageWith(`<details open>${pictureHtml("opened")}</details>`);

    // Act
    const copies = firstViewCopies(page, PHONE);

    // Assert
    expect(copies).toEqual(["/opened-800.avif"]);
  });

  it("counts a file once, however many times the page uses it, as a browser fetches it once", () => {
    // Arrange
    const page = pageWith(pictureHtml("same") + pictureHtml("same"));

    // Act
    const copies = firstViewCopies(page, PHONE);

    // Assert
    expect(copies).toEqual(["/same-800.avif"]);
  });

  it("counts an image outside any picture by its own address, so no image escapes the budget", () => {
    // Arrange
    const page = pageWith('<img src="/loose.jpg" alt="">');

    // Act
    const copies = firstViewCopies(page, PHONE);

    // Assert
    expect(copies).toEqual(["/loose.jpg"]);
  });

  it("picks a smaller copy for a screen with a lower density", () => {
    // Arrange
    const page = pageWith(pictureHtml("one"));

    // Act
    const copies = firstViewCopies(page, { width: 390, density: 1 });

    // Assert
    expect(copies).toEqual(["/one-480.avif"]);
  });

  it("refuses a picture that has no AVIF source", () => {
    // Arrange
    const page = pageWith('<picture><source type="image/webp" srcset="/a-480.webp 480w" sizes="100vw"><img src="/a.jpg" alt=""></picture>');

    // Act
    const act = (): readonly string[] => firstViewCopies(page, PHONE);

    // Assert
    expect(act).toThrow("AVIF");
  });
});
