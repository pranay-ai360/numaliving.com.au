import { PROJECT_TYPE_OPTIONS, TIMELINE_OPTIONS } from "@/lib/quotes/fields";
import { useFieldErrorProps } from "./fieldErrors";
import { FIELDSET_GRID_CLASS, FIELD_CLASS, WIDE_LABEL_CLASS } from "./formStyles";
import { SelectField } from "./SelectField";
import { TextField } from "./TextField";

export function ProjectFieldset() {
  const messageErrorProps = useFieldErrorProps("message");

  return (
    <fieldset className={FIELDSET_GRID_CLASS}>
      <legend className="eyebrow mb-4">The project</legend>
      <SelectField name="projectType" label="Project type" options={PROJECT_TYPE_OPTIONS} />
      <TextField name="location" label="Site location (city, state or country)" isRequired placeholder="e.g. Austin, Texas" />
      <TextField name="projectSize" label="Project size" placeholder="e.g. 45,000 sq ft or 120 units" />
      <TextField name="bidDate" label="Bid date" type="date" />
      <SelectField name="timeline" label="Timeline" options={TIMELINE_OPTIONS} isWide />
      <label className={WIDE_LABEL_CLASS}>
        Scope and notes *
        <textarea
          name="message"
          required
          rows={5}
          className={FIELD_CLASS}
          placeholder="What needs to be made, approximate quantities, finishes, anything else."
          {...messageErrorProps}
        />
      </label>
    </fieldset>
  );
}
