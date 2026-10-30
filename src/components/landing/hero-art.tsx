/** Hand-drawn line art on an arc: the work of validating an idea, from notes to interviews to a decision. */
export function HeroArt() {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const bg = "var(--bg)";
  return (
    <svg viewBox="0 0 1200 380" className="mx-auto block w-full max-w-[1200px] text-[var(--ink)]" role="img" aria-label="Illustration: people along an arc, each testing an idea with customers">
      <path d="M-20 360 C 220 120, 460 70, 600 70 C 740 70, 980 120, 1220 360" {...s} />
      {/* notes pile and a person holding them */}
      <g transform="translate(150 215) rotate(-12)">
        <rect x="0" y="0" width="54" height="64" rx="3" {...s} />
        <rect x="20" y="-14" width="54" height="64" rx="3" {...s} fill={bg} />
        <path d="M32 6h30M32 18h30M32 30h20" {...s} />
        <circle cx="30" cy="110" r="10" {...s} />
        <path d="M30 120v50M30 135l-20 20M30 135l22 18M30 170l-12 40M30 170l14 40" {...s} />
      </g>
      {/* building */}
      <g transform="translate(300 120) rotate(-14)">
        <rect width="96" height="62" rx="3" {...s} fill={bg} />
        <path d="M14 14h14v12H14zM41 14h14v12H41zM68 14h14v12H68zM14 36h14v12H14zM41 36h14v12H41zM68 36h14v12H68z" {...s} />
      </g>
      {/* person with a laptop for a head */}
      <g transform="translate(470 80)">
        <rect x="14" y="0" width="76" height="48" rx="4" {...s} fill={bg} />
        <path d="M32 18q4-5 8 0M64 18q4-5 8 0M40 32q12 8 24 0" {...s} />
        <path d="M6 54h92" {...s} />
        <path d="M52 54v20M52 74l-30 30h60zM30 104v8M74 104v8" {...s} />
        <path d="M22 104l-8 70 38-6 36 6-8-70" {...s} />
        <path d="M20 190l-8 50M84 190l8 50" {...s} />
      </g>
      {/* second building */}
      <g transform="translate(640 74) rotate(8)">
        <rect width="100" height="58" rx="3" {...s} fill={bg} />
        <path d="M14 12h14v12H14zM43 12h14v12H43zM72 12h14v12H72zM14 32h14v12H14zM43 32h14v12H43zM72 32h14v12H72z" {...s} />
      </g>
      {/* person with speech bubbles */}
      <g transform="translate(790 130)">
        <path d="M0 40q30-46 70 0l-8 10H8z" {...s} fill={bg} />
        <circle cx="35" cy="66" r="18" {...s} />
        <path d="M26 64h.01M44 64h.01M28 74q7 6 14 0" {...s} />
        <path d="M35 84v46M35 96l-26 22M35 96l26 20M35 130l-14 64M35 130l16 64" {...s} />
        <path d="M60 20q8-14 22-6q10-6 18 4q-4 14-20 12z" {...s} />
      </g>
      {/* house */}
      <g transform="translate(950 160) rotate(14)">
        <path d="M0 40L36 8l36 32v40H0z" {...s} fill={bg} />
        <path d="M26 80V56h20v24" {...s} />
      </g>
      {/* spinning pile of notes */}
      <g transform="translate(980 245)">
        <path d="M0 10c40-24 100-16 120 6M8 36c36-16 84-10 100 6M20 60c30-12 66-6 78 8M34 82c22-8 44-4 52 6" {...s} />
        <rect x="-8" y="-14" width="26" height="30" rx="2" {...s} fill={bg} transform="rotate(-14 5 0)" />
      </g>
    </svg>
  );
}
