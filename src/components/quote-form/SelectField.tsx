import type { QuoteRequestField } from "@/lib/quotes/fields";
import { useFieldErrorProps } from "./fieldErrors";
import { FIELD_CLASS, LABEL_CLASS, WIDE_LABEL_CLASS } from "./formStyles";

type Props = {
  name: QuoteRequestField;
  label: string;
  options: readonly string[];
  isWide?: boolean;
};

/** A required drop-down. The choices come from the shared lists in `@/lib/quotes/fields`. */
export function SelectField({ name, label, options, isWide = false }: Props) {
  const errorProps = useFieldErrorProps(name);

  return (
    <label className={isWide ? WIDE_LABEL_CLASS : LABEL_CLASS}>
      {label} *
      <select name={name} required defaultValue="" className={FIELD_CLASS} {...errorProps}>
        <option value="" disabled>
          Select…
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
