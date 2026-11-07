import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const display = Poppins({
  variable: "--f-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const body = Inter({
  variable: "--f-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deep Research Agent",
  description:
    "A team of AI agents plans the research with you, reads the web in parallel, and writes a report where every claim links to its source.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <link rel="preload" href="/bg.webp" as="image" type="image/webp" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
