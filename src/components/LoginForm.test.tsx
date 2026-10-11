import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";

const NOTICE_HEADLINE = "The client portal opens soon.";
const NOTICE_DETAIL =
  "Project teams will be invited by email when their project starts. Until then, please contact your Numa project manager.";
const SIGN_IN_GROUP = "Sign in to the client portal";

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tells visitors the client portal opens soon", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const headline = screen.getByText(NOTICE_HEADLINE);

    // Assert
    expect(headline).toBeVisible();
  });

  it("tells visitors that project teams are invited by email when a project starts", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const detail = screen.getByText(NOTICE_DETAIL);

    // Assert
    expect(detail).toBeVisible();
  });

  it("names the disabled sign-in controls as one group for screen readers", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const group = screen.getByRole("group", { name: SIGN_IN_GROUP });

    // Assert
    expect(group).toBeDisabled();
  });

  it("keeps the group's name for screen readers only, so the design does not change", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const groupName = screen.getByText(SIGN_IN_GROUP);

    // Assert
    expect(groupName.tagName).toBe("LEGEND");
    expect(groupName).toHaveClass("sr-only");
  });

  it("describes the sign-in group with the opens-soon notice", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const group = screen.getByRole("group", { name: SIGN_IN_GROUP });

    // Assert
    expect(group).toHaveAccessibleDescription(`${NOTICE_HEADLINE} ${NOTICE_DETAIL}`);
  });

  it("disables the email input", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const email = screen.getByLabelText("Email");

    // Assert
    expect(email).toBeDisabled();
  });

  it("disables the password input", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const password = screen.getByLabelText("Password");

    // Assert
    expect(password).toBeDisabled();
  });

  it("disables the Sign In button", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const signIn = screen.getByRole("button", { name: "Sign In" });

    // Assert
    expect(signIn).toBeDisabled();
  });

  it("disables the Forgot password control", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const forgotPassword = screen.getByRole("button", { name: "Forgot password?" });

    // Assert
    expect(forgotPassword).toBeDisabled();
  });

  it("links New project to the contact page", () => {
    // Arrange
    render(<LoginForm />);

    // Act
    const link = screen.getByRole("link", { name: "New project? Get in touch" });

    // Assert
    expect(link).toHaveAttribute("href", "/contact");
  });

  it("makes no network call and submits nothing when the disabled controls are used", async () => {
    // Arrange
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("LoginForm must not use the network"));
    const onSubmit = vi.fn();
    document.addEventListener("submit", onSubmit, true);
    const user = userEvent.setup();
    render(<LoginForm />);

    // Act
    await user.click(screen.getByLabelText("Email"));
    await user.keyboard("visitor@example.com{Enter}");
    await user.click(screen.getByLabelText("Password"));
    await user.keyboard("not-a-real-password{Enter}");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    document.removeEventListener("submit", onSubmit, true);

    // Assert
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("has no form to submit, so even controls re-enabled in the browser's developer tools send nothing", async () => {
    // Arrange: switch every control back on, as a visitor could in the developer tools
    const onSubmit = vi.fn();
    document.addEventListener("submit", onSubmit, true);
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);
    container.querySelectorAll("[disabled]").forEach((element) => element.removeAttribute("disabled"));

    // Act
    await user.type(screen.getByLabelText("Email"), "visitor@example.com");
    await user.type(screen.getByLabelText("Password"), "not-a-real-password{Enter}");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    document.removeEventListener("submit", onSubmit, true);

    // Assert
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });
});
