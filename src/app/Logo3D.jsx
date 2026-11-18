// 3D extruded Nextra mark (two interlocked rounded squares), slowly floating and turning.
// Pure CSS: each square is a stack of thin layers along the Z axis.
const DEPTH = 16; // number of layers per square

// side shading: dark at the back, lighter toward the front face
const TONES = {
  ink: { from: [8, 8, 7], to: [52, 52, 46], face: "#161613" },
  green: { from: [38, 66, 0], to: [80, 138, 0], face: "#5DA000" },
};

function mix(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

function Square({ tone }) {
  const c = TONES[tone];
  return (
    <div className={`nx3d-sq nx3d-${tone}`}>
      {Array.from({ length: DEPTH }, (_, i) => {
        const front = i === DEPTH - 1;
        return (
          <span
            key={i}
            className={`nx3d-layer${front ? " front" : ""}`}
            style={{
              transform: `translateZ(${i * 2}px)`,
              borderColor: front ? c.face : mix(c.from, c.to, i / (DEPTH - 2)),
            }}
          />
        );
      })}
    </div>
  );
}

export default function Logo3D() {
  return (
    <div className="nx3d" role="img" aria-label="Nextra logo">
      <div className="nx3d-glow" aria-hidden="true" />
      <div className="nx3d-stage" aria-hidden="true">
        <div className="nx3d-obj">
          <Square tone="ink" />
          <Square tone="green" />
        </div>
      </div>
      <div className="nx3d-shadow" aria-hidden="true" />
    </div>
  );
}
