import { creditsBySource, LICENSE_URL } from "@/lib/assetCredits";

/**
 * 오픈소스 3D 에셋 출처표기 — CC-BY/CC-BY-SA/MIT 저작자표기 의무 충족(법적).
 * 데이터는 `lib/assetCredits` 단일 출처. 새 에셋은 거기 등재하면 자동 반영.
 */
export function AssetCredits() {
  const groups = creditsBySource();
  return (
    <section className="mt-16 border-t border-border-soft pt-6">
      <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        오픈소스 3D 에셋
      </h2>
      <ul className="mt-3 space-y-1.5">
        {groups.map((g) => (
          <li
            key={g.source}
            className="text-[11px] leading-relaxed text-muted-foreground/80"
          >
            <span className="text-foreground/70">{g.items.map((i) => i.label).join(" · ")}</span>
            {" — "}
            {g.items[0].author} ({g.source}),{" "}
            <a
              href={LICENSE_URL[g.license]}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {g.license}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
