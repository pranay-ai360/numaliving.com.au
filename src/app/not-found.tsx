import { ButtonLink, Container } from "@/components/ui";

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
