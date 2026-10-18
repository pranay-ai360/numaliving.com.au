import { formatAddress, isRealAddress, isRealPhoneNumber, isRealWhatsappNumber, type ContactInfo } from "@/lib/realContact";

/** "Monday to Friday, 9 am to 5 pm (Central Time)"; null when no hours are set (a time zone alone says nothing). */
function hoursText({ hours, timezone }: Pick<ContactInfo, "hours" | "timezone">): string | null {
  const trimmedHours = hours?.trim() ?? "";
  if (trimmedHours === "") return null;
  const trimmedZone = timezone?.trim() ?? "";
  return trimmedZone === "" ? trimmedHours : `${trimmedHours} (${trimmedZone})`;
}

/** A `tel:` link takes the digits and the leading plus sign only. */
function telephoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * The "Talk to us" block of the Contact page: the contact email and, once the owner has set real
 * ones in `site.contact` (src/config/site.ts), the phone number, the WhatsApp number, the address and
 * the office hours with their time zone. A detail that is not real (the placeholder the site ships with, an
 * empty value, a stub with a digit changed) is not shown, and the structured data
 * (src/lib/seo/jsonld.ts) follows the same rule, so what search engines read is what a visitor sees.
 */
export function ContactDetails({ contact }: { contact: ContactInfo }) {
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
        {isRealPhoneNumber(contact.phone) && (
          <li>
            <a href={telephoneHref(contact.phone)} className="hover:text-gold">
              {contact.phone}
            </a>
          </li>
        )}
        {isRealWhatsappNumber(contact.whatsapp) && (
          <li>
            <a href={`https://wa.me/${contact.whatsapp}`} className="hover:text-gold">
              WhatsApp +{contact.whatsapp}
            </a>
          </li>
        )}
        {isRealAddress(contact.address) && (
          <li>
            <address className="not-italic text-ink-muted">{formatAddress(contact.address)}</address>
          </li>
        )}
        {hours !== null && <li className="text-ink-muted">{hours}</li>}
      </ul>
    </div>
  );
}
