import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function requestOrigin(host: string | null, forwardedProto: string | null) {
  const safeHost = host && /^[a-z0-9.:[\]-]+$/i.test(host) ? host : "localhost:3000";
  const protocol =
    forwardedProto === "http" || safeHost.startsWith("localhost")
      ? "http"
      : "https";
  return `${protocol}://${safeHost}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const origin = requestOrigin(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-proto"),
  );

  return {
    metadataBase: new URL(origin),
    title: {
      default: "SGG PLAYER ARCHIVE",
      template: "%s | SGG PLAYER ARCHIVE",
    },
    description:
      "大会戦績、保有アセット、SGGポイント、アカウント連携をひとつにまとめるプレイヤーダッシュボード。",
    openGraph: {
      title: "SGG PLAYER ARCHIVE",
      description: "あなたの挑戦と資産を、ひとつの記録へ。",
      type: "website",
      locale: "ja_JP",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "SGG PLAYER ARCHIVE — 挑戦のすべてを、ひとつの記録へ。",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "SGG PLAYER ARCHIVE",
      description: "あなたの挑戦と資産を、ひとつの記録へ。",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
