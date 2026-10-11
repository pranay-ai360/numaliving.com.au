import { factory, destinations, type MapPlace } from "@/content/locations";
import { LAND_PATH, MAP_HEIGHT, MAP_WIDTH, mapX, mapY } from "@/lib/worldMap";

const labelPos = (p: MapPlace, x: number, y: number) => {
  switch (p.label) {
    case "left":
      return { x: x - 10, y: y + 4, anchor: "end" as const };
    case "right":
      return { x: x + 10, y: y + 4, anchor: "start" as const };
    case "below":
      return { x, y: y + 20, anchor: "middle" as const };
    default:
      return { x, y: y - 12, anchor: "middle" as const };
  }
};

/** A curved line from the factory to a destination, lifted so it reads as a flight path. */
const arc = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const lift = Math.hypot(x2 - x1, y2 - y1) * 0.22;
  return `M${x1} ${y1} Q${mx} ${my - lift} ${x2} ${y2}`;
};

export function WorldMap() {
  const fx = mapX(factory.lon);
  const fy = mapY(factory.lat);
  const places = destinations.map((d) => ({ ...d, x: mapX(d.lon), y: mapY(d.lat) }));

  return (
    <figure>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label={`World map: Numa Living's factory in ${factory.name}, with delivery routes to ${destinations.map((d) => d.name).join(", ")}`}
        className="h-auto w-full"
      >
        <path d={LAND_PATH} fill="var(--brand-line)" stroke="var(--brand-paper)" strokeWidth="0.6" />

        {/* routes */}
        <g fill="none" stroke="var(--brand-gold)" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.8">
          {places.map((p) => (
            <path key={p.name} d={arc(fx, fy, p.x, p.y)} />
          ))}
        </g>

        {/* destinations */}
        {places.map((p) => {
          const l = labelPos(p, p.x, p.y);
          return (
            <g key={p.name}>
              <title>{`${p.name}, ${p.country}`}</title>
              <circle cx={p.x} cy={p.y} r="4.5" fill="var(--brand-paper)" stroke="var(--brand-gold)" strokeWidth="2" />
              <text x={l.x} y={l.y} textAnchor={l.anchor} fontSize="13" fill="var(--brand-ink-muted)" className="hidden md:block">
                {p.name}
              </text>
            </g>
          );
        })}

        {/* factory */}
        <g>
          <title>{`${factory.name}, ${factory.country}: Numa Living factory`}</title>
          <circle cx={fx} cy={fy} r="14" fill="var(--brand-gold)" opacity="0.18" className="map-pulse" />
          <circle cx={fx} cy={fy} r="7" fill="var(--brand-gold)" stroke="var(--brand-paper)" strokeWidth="2" />
          <text x={fx} y={fy - 22} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--brand-ink)" className="hidden md:block">
            {factory.name} · Factory
          </text>
        </g>
      </svg>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-gold" aria-hidden="true" /> Numa Living factory, {factory.name}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-gold bg-paper" aria-hidden="true" /> Delivery destinations
        </span>
      </figcaption>
    </figure>
  );
}
