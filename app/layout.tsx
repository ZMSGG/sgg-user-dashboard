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
  try {
    return new URL(`${protocol}://${safeHost}`).origin;
  } catch {
    return "http://localhost:3000";
  }
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
    icons: {
      // .ico first so the tab gets a hand-sized 16/32 render rather than a
      // browser downscale of the 512; PNG covers clients that skip .ico.
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/my-sgg-icon-v004.png", type: "image/png", sizes: "512x512" },
      ],
      apple: "/apple-touch-icon.png",
    },
    robots: { index: false, follow: false },
    openGraph: {
      title: "MY SGG｜All of SGG. One Player OS.",
      description: "遊ぶ。競う。集める。すべてのSGGを、ひとつに。",
      type: "website",
      locale: "ja_JP",
      images: [
        {
          // JPEG, not PNG: the card is a painted scene, so PNG cost 1.5MB
          // against 337KB here for no visible difference, and every scraper
          // that unfurls a link pays that download.
          url: "/my-sgg-social-og-v004.jpg",
          type: "image/jpeg",
          width: 1200,
          height: 630,
          alt: "満月の神域で背中合わせに構える蒼毘と大耀 — MY SGG",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "MY SGG｜All of SGG. One Player OS.",
      description: "遊ぶ。競う。集める。すべてのSGGを、ひとつに。",
      images: ["/my-sgg-social-og-v004.jpg"],
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
