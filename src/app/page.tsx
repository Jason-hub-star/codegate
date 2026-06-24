import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AssetCredits } from "@/components/AssetCredits";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-8 py-20">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        CODEGATE 2026 · AI 회로 튜터
      </p>
      <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl">
        핀메이트
        <span className="text-muted-foreground"> / PinMate</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
        빵판 배선을 3D로 그리면, AI가 한국어로 회로 오류를 즉시 짚어 주는
        입문자용 디지털 트윈 회로 튜터.
      </p>
      <div className="mt-10 flex items-center gap-3">
        <Link href="/build" className={cn(buttonVariants({ size: "lg" }))}>
          빌드 시작하기
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          3D 빵판 · 점퍼 배선 · 결정론 진단
        </span>
      </div>
      <AssetCredits />
    </main>
  );
}
