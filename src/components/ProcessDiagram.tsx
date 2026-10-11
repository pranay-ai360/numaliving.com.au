import { ProcessIcon } from "./ProcessIcons";

type Step = { phase: string; icon: string; name: string; text: string };

/**
 * The Process page diagram: steps grouped into phases, each step an icon
 * on a connecting line. Two rows of four on a laptop, pairs on a phone.
 * Everything shown comes from `process.steps` in src/content/pages.ts.
 */
export function ProcessDiagram({ steps }: { steps: readonly Step[] }) {
  // Group steps by phase, keeping their order and their overall numbers
  const groups: { phase: string; items: { step: Step; n: number }[] }[] = [];
  steps.forEach((step, i) => {
    const last = groups[groups.length - 1];
    if (last && last.phase === step.phase) last.items.push({ step, n: i });
    else groups.push({ phase: step.phase, items: [{ step, n: i }] });
  });

  return (
    <ol className="grid gap-y-14 md:grid-cols-2" aria-label="Our process in eight steps">
      {groups.map((g, gi) => (
        <li key={g.phase}>
          {/* phase heading */}
          <div className="mx-2 flex items-center gap-4">
            <span className="display text-xs text-gold">{String(gi + 1).padStart(2, "0")}</span>
            <span className="eyebrow">{g.phase}</span>
            <span className="h-px flex-1 bg-gold/40" aria-hidden="true" />
          </div>

          <ol className="mt-8 grid grid-cols-2">
            {g.items.map(({ step, n }) => {
              // Connecting line: runs through the icon circles along each row,
              // starting at the first step of a row and ending at the last.
              const rowStart = n % 4 === 0;
              const rowEnd = n % 4 === 3;
              const phoneStart = n % 2 === 0;
              const phoneEnd = n % 2 === 1;
              const leftLine = rowStart ? "hidden" : phoneStart ? "max-md:hidden" : "";
              const rightLine = rowEnd ? "hidden" : phoneEnd ? "max-md:hidden" : "";
              return (
                <li key={step.name} className="relative px-2 text-center">
                  <span aria-hidden="true" className={`absolute left-0 right-1/2 top-8 h-px bg-gold/40 ${leftLine}`} />
                  <span aria-hidden="true" className={`absolute left-1/2 right-0 top-8 h-px bg-gold/40 ${rightLine}`} />

                  <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold bg-paper text-gold">
                    <ProcessIcon name={step.icon} className="h-7 w-7" />
                    <span className="display absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[0.62rem] text-white">
                      {n + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold leading-snug">{step.name}</h3>
                  <p className="mx-auto mt-2 max-w-[15rem] text-sm leading-relaxed text-ink-muted">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
