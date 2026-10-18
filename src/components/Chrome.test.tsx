import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/Chrome";

describe("Footer", () => {
  it("links the privacy notice and the website terms, which have no place in the main menu", () => {
    // Arrange
    render(<Footer />);

    // Act
    const legal = within(screen.getByRole("navigation", { name: "Legal" }));
    const links = legal.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);

    // Assert
    expect(links).toEqual([
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ]);
  });

  it("still links the main pages and the client login", () => {
    // Arrange
    render(<Footer />);

    // Act
    const names = screen.getAllByRole("link").map((link) => link.textContent);

    // Assert
    expect(names).toEqual(expect.arrayContaining(["Home", "About", "Projects", "Capabilities", "Process", "Contact", "Client Login"]));
  });

  it("shows the contact email as a link", () => {
    // Arrange
    render(<Footer />);

    // Act
    const link = screen.getByRole("link", { name: "projects@numaliving.us" });

    // Assert
    expect(link).toHaveAttribute("href", "mailto:projects@numaliving.us");
  });
});
