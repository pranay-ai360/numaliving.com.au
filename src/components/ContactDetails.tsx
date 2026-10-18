import type { site } from "@/config/site";

type Contact = Pick<typeof site.contact, "email" | "hours" | "timezone">;

/** "Monday to Friday, 9 am to 5 pm (Central Time)"; null when no hours are set (a time zone alone says nothing). */
function hoursText({ hours, timezone }: Pick<Contact, "hours" | "timezone">): string | null {
  const trimmedHours = hours?.trim() ?? "";
  if (trimmedHours === "") return null;
  const trimmedZone = timezone?.trim() ?? "";
  return trimmedZone === "" ? trimmedHours : `${trimmedHours} (${trimmedZone})`;
}

/**
 * The "Talk to us" block of the Contact page: the contact email and, once the owner has set them in
 * `site.contact` (src/config/site.ts), the office hours with their time zone. Until then only the
 * email shows.
 */
export function ContactDetails({ contact }: { contact: Contact }) {
  const hours = hoursText(contact);
  return (
    <div>
      <p className="eyebrow">Talk to us</p>
      <ul className="mt-4 space-y-2">
        <li>
          <a href={`mailto:${contact.email}`} className="hover:text-gold">
            {contact.email}
          </a>
        </li>
        {hours !== null && <li className="text-ink-muted">{hours}</li>}
      </ul>
    </div>
  );
}
