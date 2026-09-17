import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM-Wiki Web",
  description: "Topic-based Knowledge Base with Claude Code CLI Integration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col overflow-hidden">
        {children}
      </body>
    </html>
  );
}
