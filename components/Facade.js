// A building drawn as a grid of windows: one window per unit, lit when the unit is occupied.
// Pure presentational component (no hooks), so server and client pages can both use it.

export function BrandMark({ size = 30 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="3.5" width="22" height="25" rx="2" fill="#06222d" stroke="#9fc0cc" strokeWidth="1.5" />
      <rect x="9" y="8" width="6" height="7" fill="#f2c25b" />
      <rect x="17" y="8" width="6" height="7" fill="#15485c" />
      <rect x="9" y="18" width="6" height="7" fill="#15485c" />
      <rect x="17" y="18" width="6" height="7" fill="#f2c25b" />
    </svg>
  );
}

function pickColumns(count) {
  if (count <= 6) return 3;
  if (count <= 12) return 4;
  if (count <= 20) return 5;
  return 6;
}

export default function Facade({ units, cols, caption, emptyText = "No units yet." }) {
  const occupied = units.filter((u) => u.occupied).length;
  const summary = `${occupied} of ${units.length} units occupied`;

  return (
    <div className="facade" role="img" aria-label={summary}>
      <div className="facade-roof" />
      {units.length === 0 ? (
        <p className="facade-empty">{emptyText}</p>
      ) : (
        <div className="facade-grid" style={{ "--cols": cols ?? pickColumns(units.length) }}>
          {units.map((unit, i) => (
            <div
              key={unit.id ?? i}
              className={`win ${unit.occupied ? "win-lit" : ""}`}
              title={unit.label ? `${unit.label}: ${unit.occupied ? "occupied" : "available"}` : undefined}
            />
          ))}
        </div>
      )}
      <div className="facade-ground" />
      {caption !== null && (
        <p className="facade-caption">{caption ?? <strong>{summary}</strong>}</p>
      )}
    </div>
  );
}
