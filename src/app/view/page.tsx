import { Suspense } from "react";
import { ViewPageContent } from "./content";

/**
 * 모바일 전용 회로 읽기 뷰.
 * 쿼리 파라미터: c (필수, 코덱된 회로) / t (선택, 제목)
 *
 * useSearchParams 는 Suspense 경계가 필요하므로 별도 클라이언트 컴포넌트로 분리.
 */
export default function ViewPage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-surface-1" />}>
      <ViewPageContent />
    </Suspense>
  );
}
