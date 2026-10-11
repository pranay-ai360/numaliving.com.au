import { QUOTE_REQUEST_FIELDS } from "@/lib/quotes/fields";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The Quote Request fields exactly as the visitor typed them. Nothing is
 * checked or trimmed here: `submitQuoteRequest` validates them against the
 * schema. Other form fields (the honeypot, for example) are left out.
 */
export function readQuoteRequest(formData: FormData): Record<string, string> {
  return Object.fromEntries(QUOTE_REQUEST_FIELDS.map((name) => [name, textValue(formData, name)]));
}
