import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonLd } from "@/components/JsonLd";

function scriptsIn(container: HTMLElement): readonly HTMLScriptElement[] {
  return Array.from(container.querySelectorAll("script"));
}

describe("JsonLd", () => {
  it("writes the data as one script of type application/ld+json that reads back as the same data", () => {
    // Arrange
    const data = { "@context": "https://schema.org", "@type": "Organization", name: "Numa Living" };

    // Act
    const { container } = render(<JsonLd data={data} />);

    // Assert
    const [script] = scriptsIn(container);
    expect(scriptsIn(container)).toHaveLength(1);
    expect(script).toHaveAttribute("type", "application/ld+json");
    expect(JSON.parse(script.textContent ?? "")).toEqual(data);
  });

  it("cannot be made to close its own script tag, whatever the data holds", () => {
    // Arrange
    const data = { "@type": "Thing", name: "</script><script>window.attacked = true</script><!--" };

    // Act
    const { container } = render(<JsonLd data={data} />);

    // Assert
    const [script] = scriptsIn(container);
    expect(scriptsIn(container)).toHaveLength(1);
    expect(container.innerHTML).not.toContain("</script><script>");
    expect(script.textContent).toContain("\\u003c/script>");
    expect(JSON.parse(script.textContent ?? "")).toEqual(data);
  });

  it("writes the line and paragraph separators as escapes", () => {
    // Arrange
    const data = { "@type": "Thing", name: "one\u2028two\u2029three" };

    // Act
    const { container } = render(<JsonLd data={data} />);

    // Assert
    const text = scriptsIn(container)[0].textContent ?? "";
    expect(text).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(text)).toEqual(data);
  });

  it("accepts a list of entities", () => {
    // Arrange
    const data = [{ "@type": "Thing" }, { "@type": "Place" }];

    // Act
    const { container } = render(<JsonLd data={data} />);

    // Assert
    expect(JSON.parse(scriptsIn(container)[0].textContent ?? "")).toEqual(data);
  });
});
