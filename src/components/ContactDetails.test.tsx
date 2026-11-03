import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactDetails } from "@/components/ContactDetails";
import { site } from "@/config/site";
import { isRealAddress, isRealPhoneNumber, isRealWhatsappNumber, type ContactInfo } from "@/lib/realContact";

/** Details that are real, the way the launch guard requires them before the site may be indexed. */
const REAL: ContactInfo = {
  email: "projects@numaliving.us",
  phone: "+1 512 555 0147",
  whatsapp: "15125550147",
  address: { street: "1 Example Street", locality: "Austin", region: "TX", postalCode: "78701", country: "United States" },
  hours: null,
  timezone: null,
};

/** The placeholders the site ships with until the owner supplies the real ones. */
const STUBS: ContactInfo = {
  ...REAL,
  phone: "+971 4 000 0000",
  whatsapp: "971400000000",
  address: { street: "Factory address", locality: "Dubai", country: "UAE" },
};

describe("ContactDetails", () => {
  it("shows the contact email as a link that opens an email to it", () => {
    // Arrange
    render(<ContactDetails contact={STUBS} />);

    // Act
    const link = screen.getByRole("link", { name: "projects@numaliving.us" });

    // Assert
    expect(link).toHaveAttribute("href", "mailto:projects@numaliving.us");
  });

  it("shows the phone number as a link that calls it, once it is real", () => {
    // Arrange
    render(<ContactDetails contact={REAL} />);

    // Act
    const link = screen.getByRole("link", { name: "+1 512 555 0147" });

    // Assert
    expect(link).toHaveAttribute("href", "tel:+15125550147");
  });

  it("shows the WhatsApp number as a link that opens a chat, once it is real", () => {
    // Arrange
    render(<ContactDetails contact={REAL} />);

    // Act
    const link = screen.getByRole("link", { name: "WhatsApp +15125550147" });

    // Assert
    expect(link).toHaveAttribute("href", "https://wa.me/15125550147");
  });

  it("shows the address on one line in an address element, once it is real", () => {
    // Arrange
    render(<ContactDetails contact={REAL} />);

    // Act
    const address = screen.getByText("1 Example Street, Austin, TX 78701, United States");

    // Assert
    expect(address.tagName).toBe("ADDRESS");
  });

  it("shows the email, phone, WhatsApp number and address, one to a line, when all are real", () => {
    // Arrange
    render(<ContactDetails contact={REAL} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(4);
  });

  it("shows none of the placeholder phone number, WhatsApp number or address", () => {
    // Arrange
    const { container } = render(<ContactDetails contact={STUBS} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
    expect(container.textContent).not.toMatch(/000 0000|971400000000|Factory address/);
  });

  it.each([
    ["a phone number of zeros made to look different", { phone: "+971 4 000 0001" }],
    ["a WhatsApp number of zeros made to look different", { whatsapp: "971400000001" }],
    ["an address with no street number", { address: { street: "Factory address.", locality: "Dubai", country: "UAE" } }],
    ["an empty phone number", { phone: "" }],
    ["an address with no city", { address: { street: "1 Example Street", locality: "", country: "United States" } }],
  ])("leaves out %s, since it is not real", (_label, override) => {
    // Arrange
    render(<ContactDetails contact={{ ...REAL, ...override }} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(3);
  });

  it("shows no hours while none are set", () => {
    // Arrange
    render(<ContactDetails contact={STUBS} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
    expect(screen.queryByText(/am to|pm/i)).not.toBeInTheDocument();
  });

  it("shows the hours with their time zone once both are set", () => {
    // Arrange
    render(<ContactDetails contact={{ ...STUBS, hours: "Monday to Friday, 9 am to 5 pm", timezone: "Central Time" }} />);

    // Act
    const hours = screen.getByText("Monday to Friday, 9 am to 5 pm (Central Time)");

    // Assert
    expect(hours).toBeInTheDocument();
  });

  it("shows the hours alone when there is no time zone", () => {
    // Arrange
    render(<ContactDetails contact={{ ...STUBS, hours: "Monday to Friday, 9 am to 5 pm" }} />);

    // Act
    const hours = screen.getByText("Monday to Friday, 9 am to 5 pm");

    // Assert
    expect(hours).toBeInTheDocument();
  });

  it("shows nothing for a time zone that has no hours to go with it", () => {
    // Arrange
    render(<ContactDetails contact={{ ...STUBS, timezone: "Central Time" }} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
    expect(screen.queryByText(/Central Time/)).not.toBeInTheDocument();
  });

  it("ignores hours that are only blanks", () => {
    // Arrange
    render(<ContactDetails contact={{ ...STUBS, hours: "   ", timezone: "Central Time" }} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(1);
  });

  it("accepts the site's own contact settings and shows a row for each detail that is real in them", () => {
    // Arrange
    const { phone, whatsapp, address, hours } = site.contact;
    const expectedRows = 1 + [isRealPhoneNumber(phone), isRealWhatsappNumber(whatsapp), isRealAddress(address), hours !== null].filter(Boolean).length;
    render(<ContactDetails contact={site.contact} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(expectedRows);
  });
});
