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
 * search engines. Small and quiet on purpose. Each separator is an aria-hidden span (text drawn with CSS
 * generated content can be read aloud), so assistive technology reads only the steps; the last step is
 * the current page and is not a link.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const trail = [HOME, ...items];
  const lastIndex = trail.length - 1;
  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          {trail.map((item, index) => (
            <li key={item.path}>
              {index > 0 && (
                <span aria-hidden="true" className="mr-2 text-ink-muted/50">
                  /
                </span>
              )}
              {index === lastIndex ? (
                <span aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.path} className="transition-colors hover:text-gold-dark">
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
