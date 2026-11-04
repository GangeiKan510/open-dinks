import type { Metadata } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { siteUrl } from "@/lib/env";
import { formatDocumentTitle, PRODUCT_NAME } from "@/lib/facility";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const logo = localFont({
  src: "../fonts/TAN-NIMBUS.woff2",
  variable: "--font-logo",
  weight: "400",
});

const display = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_DESCRIPTION =
  "Cloud-first open play for pickleball: fair rotations, live queues, QR check-in, and TV wallboards.";

const OG_IMAGE = {
  url: "/picklrz-og-image.png",
  width: 1200,
  height: 630,
  alt: "Picklrz — tournaments, matchmaking, and court hours for pickleball facilities",
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: formatDocumentTitle(),
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: PRODUCT_NAME,
    title: formatDocumentTitle(),
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: formatDocumentTitle(),
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${logo.variable} ${display.variable} ${body.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
