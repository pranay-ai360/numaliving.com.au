import { ROLE_OPTIONS } from "@/lib/quotes/fields";
import { FIELDSET_GRID_CLASS } from "./formStyles";
import { SelectField } from "./SelectField";
import { TextField } from "./TextField";

export function AboutYouFieldset() {
  return (
    <fieldset className={FIELDSET_GRID_CLASS}>
      <legend className="eyebrow mb-4">About you</legend>
      <TextField name="name" label="Full name" isRequired autoComplete="name" />
      <TextField name="company" label="Company" autoComplete="organization" />
      <TextField name="email" label="Email" type="email" isRequired autoComplete="email" />
      <TextField name="phone" label="Phone / WhatsApp" type="tel" autoComplete="tel" />
      <SelectField name="role" label="Your role" options={ROLE_OPTIONS} isWide />
    </fieldset>
  );
}
