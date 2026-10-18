import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactDetails } from "@/components/ContactDetails";
import { site } from "@/config/site";

const EMAIL_ONLY = { email: "projects@numaliving.us", hours: null, timezone: null } as const;

describe("ContactDetails", () => {
  it("shows the contact email as a link that opens an email to it", () => {
    // Arrange
    render(<ContactDetails contact={EMAIL_ONLY} />);

    // Act
    const link = screen.getByRole("link", { name: "projects@numaliving.us" });

    // Assert
    expect(link).toHaveAttribute("href", "mailto:projects@numaliving.us");
  });

  it("shows no hours while none are set", () => {
    // Arrange
    render(<ContactDetails contact={EMAIL_ONLY} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
    expect(screen.queryByText(/am to|pm/i)).not.toBeInTheDocument();
  });

  it("shows the hours with their time zone once both are set", () => {
    // Arrange
    render(<ContactDetails contact={{ ...EMAIL_ONLY, hours: "Monday to Friday, 9 am to 5 pm", timezone: "Central Time" }} />);

    // Act
    const hours = screen.getByText("Monday to Friday, 9 am to 5 pm (Central Time)");

    // Assert
    expect(hours).toBeInTheDocument();
  });

  it("shows the hours alone when there is no time zone", () => {
    // Arrange
    render(<ContactDetails contact={{ ...EMAIL_ONLY, hours: "Monday to Friday, 9 am to 5 pm" }} />);

    // Act
    const hours = screen.getByText("Monday to Friday, 9 am to 5 pm");

    // Assert
    expect(hours).toBeInTheDocument();
  });

  it("shows nothing for a time zone that has no hours to go with it", () => {
    // Arrange
    render(<ContactDetails contact={{ ...EMAIL_ONLY, timezone: "Central Time" }} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
    expect(screen.queryByText(/Central Time/)).not.toBeInTheDocument();
  });

  it("ignores hours that are only blanks", () => {
    // Arrange
    render(<ContactDetails contact={{ ...EMAIL_ONLY, hours: "   ", timezone: "Central Time" }} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
  });

  it("reads the real site contact, which has no hours or time zone yet", () => {
    // Arrange
    render(<ContactDetails contact={site.contact} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(site.contact.hours).toBeNull();
    expect(site.contact.timezone).toBeNull();
    expect(items).toHaveLength(1);
  });
});
