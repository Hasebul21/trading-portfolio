import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { JetBrains_Mono, Lato } from "next/font/google";
import {
  NO_FOUC_THEME_SCRIPT,
  ThemeProvider,
} from "@/components/theme-provider";
import "./globals.css";


// Lato carries all weights the system needs (light 300 / regular / medium /
// bold / black). JetBrains Mono is used for symbols and tabular numbers.
const lato = Lato({
  variable: "--font-lato",
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Personal buy/sell ledger and holdings",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit:cover lets us paint behind the notch / Dynamic Island and
  // use env(safe-area-inset-*) padding so content stays clear of the gesture
  // bar on iPhones running iOS Safari.
  viewportFit: "cover",
  themeColor: "#1F1E1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Default to dark before the inline script runs — avoids a flash for
      // users who haven't loaded yet.
      className={`${lato.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <head>
        {/*
          Inline theme bootstrap — runs synchronously before React hydrates,
          so the persisted preference is applied to <html> before paint.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: NO_FOUC_THEME_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AntdRegistry>{children}</AntdRegistry>
        </ThemeProvider>
      </body>
    </html>
  );
}
