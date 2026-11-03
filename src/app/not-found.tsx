import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";
import { renderedTitle } from "@/lib/seo/metadata";

// The page sits in the root layout's own folder, which the layout's title template does not reach, so
// the title is written out whole. Next.js adds `noindex` to a 404 page by itself.
export const metadata: Metadata = { title: { absolute: renderedTitle({ title: "Page Not Found" }) } };

export default function NotFound() {
  return (
    <section className="py-32">
      <Container className="text-center">
        <p className="eyebrow">404</p>
        <h1 className="display mt-4 text-2xl">Page Not Found</h1>
        <div className="mt-10">
          <ButtonLink href="/">Back Home</ButtonLink>
        </div>
      </Container>
    </section>
  );
}
