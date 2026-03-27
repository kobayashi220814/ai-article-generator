import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AI Article Generator",
  description: "AI-powered SEO article generation tool",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
