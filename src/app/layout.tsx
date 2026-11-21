import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Transcript Generator: free, no ads",
  description: "Paste a YouTube link and get the full transcript. Copy it or download .txt, .srt, .vtt or .json.",
};

export const viewport: Viewport = { themeColor: "#1d4ed8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label="YouTube Transcript home">
              <span className="brand-mark" aria-hidden>▶</span>
              <span>
                YouTube<strong>Transcript</strong>
              </span>
            </Link>
          </div>
        </header>
        <main className="container main">{children}</main>
        <footer className="site-footer">
          <div className="container">No ads. No tracking. Transcripts come from YouTube&apos;s own captions.</div>
        </footer>
      </body>
    </html>
  );
}
