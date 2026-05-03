import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Noto_Sans_TC } from "next/font/google"
import "./globals.css"

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const notoSansTC = Noto_Sans_TC({
  weight: ["700"],
  subsets: ["latin", "chinese-traditional"],
  variable: "--font-noto-sans-tc",
  display: "swap",
})

export const metadata: Metadata = {
  title: "AI Article Generator",
  description: "AI-powered SEO article generation tool",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={`h-full ${plusJakartaSans.variable} ${notoSansTC.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
