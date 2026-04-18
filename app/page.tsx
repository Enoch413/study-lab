import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="hero-kicker">CODE LAB 내부 모듈 미리보기</span>
        <h1 className="hero-title">STUDY LAB</h1>
        <p className="hero-copy">
          로그인 연동 전 단계에서 STUDY LAB의 핵심 흐름을 먼저 확인하는 화면입니다. 카메라 필수 입실, 강사용
          전체 현황판, 질문 요청, 1:1 질문방 자동 이동 흐름을 미리 테스트할 수 있습니다.
        </p>
        <div className="toolbar">
          <Link className="button-primary" href="/study-lab">
            STUDY LAB 열기
          </Link>
        </div>
      </section>
    </main>
  );
}
