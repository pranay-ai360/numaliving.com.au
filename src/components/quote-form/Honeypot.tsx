import { HONEYPOT_FIELD_NAME } from "./constants";

/**
 * A field no visitor can see or reach. Automated form fillers tend to fill
 * every input, so a filled honeypot marks the request as a bot's. The
 * `hidden` wrapper takes it out of the page for people, assistive technology
 * and autofill alike (browsers do not autofill fields that are not displayed);
 * it is also skipped by the Tab key and told not to autofill.
 */
export function Honeypot() {
  return (
    <div hidden aria-hidden="true">
      <label>
        Leave this field empty
        <input type="text" name={HONEYPOT_FIELD_NAME} tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
