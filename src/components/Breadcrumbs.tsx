import Link from "next/link";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo/jsonld";
import { JsonLd } from "./JsonLd";

const HOME: BreadcrumbItem = { name: "Home", path: "/" };

type BreadcrumbsProps = {
  /** The steps below Home, ending with the page itself, for example [{ name: "Projects", path: "/projects" }, { name: "Test Villa", path: "/projects/test-villa" }]. */
  items: readonly BreadcrumbItem[];
};

/**
 * "Home / Projects / Test Villa": where the page sits, for visitors and, as a BreadcrumbList, for
 * search engines. Small and quiet on purpose. The separators are drawn with CSS, so assistive
 * technology reads only the steps; the last step is the current page and is not a link.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const trail = [HOME, ...items];
  const lastIndex = trail.length - 1;
  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          {trail.map((item, index) => (
            <li key={item.path} className={index > 0 ? "before:mr-2 before:text-ink-muted/50 before:content-['/']" : undefined}>
              {index === lastIndex ? (
                <span aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.path} className="transition-colors hover:text-gold">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </>
  );
}
