import type { QuoteRequestField } from "@/lib/quotes/fields";
import { useFieldErrorProps } from "./fieldErrors";
import { FIELD_CLASS, LABEL_CLASS } from "./formStyles";

type Props = {
  name: QuoteRequestField;
  label: string;
  isRequired?: boolean;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  placeholder?: string;
};

export function TextField({ name, label, isRequired = false, type = "text", autoComplete, placeholder }: Props) {
  const errorProps = useFieldErrorProps(name);

  return (
    <label className={LABEL_CLASS}>
      {label}
      {isRequired && " *"}
      <input
        name={name}
        type={type}
        required={isRequired}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={FIELD_CLASS}
        {...errorProps}
      />
    </label>
  );
}
