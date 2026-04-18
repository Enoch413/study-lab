import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "STUDY LAB 프로토타입",
  description: "학원용 카메라 필수 온라인 자습실 프로토타입",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
