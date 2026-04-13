import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "OWCS 관리자 페이지",
  description: "OWCS 시즌 원본 데이터를 관리하는 한국어 관리자 페이지"
};

export default function AdminLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
