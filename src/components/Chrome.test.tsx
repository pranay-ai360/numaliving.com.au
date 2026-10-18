import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloatingActions, Footer } from "@/components/Chrome";

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

describe("FloatingActions", () => {
  it("offers the Inquire Now tab, which leads to the Contact page", () => {
    // Arrange
    render(<FloatingActions />);

    // Act
    const link = screen.getByRole("link", { name: "Inquire Now" });

    // Assert
    expect(link).toHaveAttribute("href", "/contact");
  });

  it("renders nothing else: no empty box is left where phone and WhatsApp buttons once were", () => {
    // Arrange
    const { container } = render(<FloatingActions />);

    // Act
    const emptyElements = Array.from(container.querySelectorAll("*")).filter((element) => element.children.length === 0 && (element.textContent ?? "").trim() === "");

    // Assert
    expect(emptyElements).toEqual([]);
    expect(container.children).toHaveLength(1);
  });
});
