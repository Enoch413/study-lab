import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="hero-kicker">CODE LAB 내부 모듈 미리보기</span>
        <h1 className="hero-title">STUDY LAB</h1>
        <p className="hero-copy">
          로그인 연동 뒤에 STUDY LAB으로 이동하기 전에 카메라 준비 화면과 메인룸 흐름을
          먼저 확인하는 테스트 페이지입니다.
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
