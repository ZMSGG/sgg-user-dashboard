import type { Metadata } from "next";
import type { Viewport } from "next";
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
      default: "MY SGG｜All of SGG. One Player OS.",
      template: "%s | MY SGG",
    },
    description:
      "公開中のSGGゲーム、ランキング、キャラクター図鑑、公式アップデート、プレイヤー記録をひとつに束ねるSGG Player OS。",
    robots: { index: false, follow: false },
    openGraph: {
      title: "MY SGG｜All of SGG. One Player OS.",
      description: "遊ぶ。競う。集める。すべてのSGGを、ひとつに。",
      type: "website",
      locale: "ja_JP",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "MY SGG — All of SGG. One Player OS.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "MY SGG｜All of SGG. One Player OS.",
      description: "遊ぶ。競う。集める。すべてのSGGを、ひとつに。",
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08070d",
};

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
