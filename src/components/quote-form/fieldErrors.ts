/**
 * Field-level validation errors: the field the latest problem is about is
 * marked invalid, linked to the message that explains it, and focused.
 */
import { createContext, useContext } from "react";
import type { InvalidField } from "@/lib/types";

/** The field the latest validation problem is about, and the id of the text that explains it. */
export type FieldError = {
  readonly field: InvalidField;
  readonly messageId: string;
};

export const FieldErrorContext = createContext<FieldError | null>(null);

/** The ARIA attributes for a field: absent when the field is fine and has no description of its own. */
export type FieldErrorProps = {
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * Marks `field` invalid when the latest problem is about it. `describedBy`
 * is the field's own description, which is kept ahead of the problem.
 */
export function useFieldErrorProps(field: InvalidField, describedBy?: string): FieldErrorProps {
  const error = useContext(FieldErrorContext);
  const isInvalid = error !== null && error.field === field;
  const ids = [describedBy, isInvalid ? error.messageId : undefined].filter((id): id is string => id !== undefined);
  return {
    ...(isInvalid ? { "aria-invalid": true } : {}),
    ...(ids.length > 0 ? { "aria-describedby": ids.join(" ") } : {}),
  };
}

/** The control for `field` inside the form, so focus can be moved to it. */
export function findField(form: HTMLFormElement | null, field: InvalidField): HTMLElement | null {
  if (form === null) return null;
  const control = field === "drawings" ? form.querySelector('input[type="file"]') : form.elements.namedItem(field);
  return control instanceof HTMLElement ? control : null;
}
