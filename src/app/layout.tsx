import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "OWCS 시즌 아카이브 예측기",
  description: "다중 시즌 경기 결과 아카이브와 Monte Carlo 순위 예측 웹앱"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
