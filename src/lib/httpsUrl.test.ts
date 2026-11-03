import { describe, expect, it } from "vitest";
import { isHttpsUrl } from "@/lib/httpsUrl";

describe("isHttpsUrl", () => {
  it.each(["https://example.com", "https://www.linkedin.com/in/example", "HTTPS://EXAMPLE.COM/a.pdf", "https://drive.google.com/file/d/abc/view?usp=sharing"])("accepts %s", (url) => {
    // Arrange
    // (the table supplies the address)

    // Act
    const result = isHttpsUrl(url);

    // Assert
    expect(result).toBe(true);
  });

  it.each(["", "   ", "example.com", "http://example.com", "javascript:alert(1)", "//example.com", "https://", "ftp://example.com", "data:text/html,x", "file:///etc/passwd", "my plans are on the shared drive"])(
    "refuses %j",
    (url) => {
      // Arrange
      // (the table supplies the text)

      // Act
      const result = isHttpsUrl(url);

      // Assert
      expect(result).toBe(false);
    },
  );
});
