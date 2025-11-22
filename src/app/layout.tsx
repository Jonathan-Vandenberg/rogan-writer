import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

import { ThemeProvider } from "@/components/providers/theme-provider"
import { SessionProviderWrapper } from "@/components/providers/session-provider"
import { SelectedBookProvider } from "@/contexts/selected-book-context"
import { MainLayout } from "@/components/layout/main-layout"
import { Toaster } from "sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "little brother - Professional Book Writing App",
  description: "A comprehensive book writing application with AI assistance, plot tracking, and collaborative features.",
}

// DEPLOYMENT TEST

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProviderWrapper>
          <SelectedBookProvider>
            <ThemeProvider>
              <MainLayout>
                {children}
              </MainLayout>
              <Toaster position="top-right" />
            </ThemeProvider>
          </SelectedBookProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
