"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { AppSidebar } from "./app-sidebar"
import { BookSelector } from "./book-selector"
import { UserNav } from "./user-nav"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status } = useSession()

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If user is not authenticated, show simple layout without sidebar/navigation
  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    )
  }

  // If user is authenticated, show full layout with sidebar and navigation
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex items-center gap-2 flex-1">
            <BookSelector />
          </div>
          <div className="flex items-center gap-2">
            <UserNav />
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 