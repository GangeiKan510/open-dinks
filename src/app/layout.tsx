import type { Metadata } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
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

export const metadata: Metadata = {
  title: {
    default: formatDocumentTitle(),
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Cloud-first open play for pickleball: fair rotations, live queues, QR check-in, and TV wallboards.",
  manifest: "/site.webmanifest",
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
