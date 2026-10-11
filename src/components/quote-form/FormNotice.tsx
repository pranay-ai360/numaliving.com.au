import { fallbackEmailHref, type FallbackReason } from "@/lib/quotes/emailLinks";
import type { InvalidField } from "@/lib/types";

/** A message above the Send button. */
export type Notice = {
  text: string;
  /** When set, the notice offers to email instead; the reason code goes in the email's subject. */
  emailReason: FallbackReason | null;
  /** The field the problem is about, which is marked invalid and given focus. */
  field: InvalidField | null;
};

type Props = {
  notice: Notice;
  /** The id of the message text, which the invalid field points to with aria-describedby. */
  textId: string;
};

export function FormNotice({ notice, textId }: Props) {
  return (
    <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p id={textId}>{notice.text}</p>
      {notice.emailReason !== null && (
        <p className="mt-2">
          <a href={fallbackEmailHref(notice.emailReason)} className="font-medium underline">
            Email us instead
          </a>
        </p>
      )}
    </div>
  );
}
