import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  OWCS_SITE_DESCRIPTION,
  OWCS_SITE_KEYWORDS,
  OWCS_SITE_NAME,
  OWCS_SITE_SHORT_NAME,
  getMetadataBase
} from "@/app/site-config";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: OWCS_SITE_NAME,
    template: `%s | ${OWCS_SITE_SHORT_NAME}`
  },
  description: OWCS_SITE_DESCRIPTION,
  applicationName: OWCS_SITE_SHORT_NAME,
  keywords: OWCS_SITE_KEYWORDS,
  alternates: {
    canonical: "/"
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: OWCS_SITE_SHORT_NAME,
    title: OWCS_SITE_NAME,
    description: OWCS_SITE_DESCRIPTION
  },
  twitter: {
    card: "summary_large_image",
    title: OWCS_SITE_NAME,
    description: OWCS_SITE_DESCRIPTION
  }
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
