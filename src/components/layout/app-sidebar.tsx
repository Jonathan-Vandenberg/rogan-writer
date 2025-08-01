"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  PenTool,
  Users,
  Map,
  Lightbulb,
  BarChart3,
  Settings,
  Home,
  FileText,
  Calendar,
  Target,
  Bookmark,
  Download,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const navigationItems = [
  {
    title: "Writing",
    items: [
      { title: "Dashboard", url: "/", icon: Home },
      { title: "Write", url: "/write", icon: PenTool },
      { title: "Chapters", url: "/chapters", icon: BookOpen },
      { title: "Pages", url: "/pages", icon: FileText },
    ],
  },
  {
    title: "Planning",
    items: [
      { title: "Brainstorming", url: "/brainstorming", icon: Lightbulb },
      { title: "Plot Structure", url: "/plot", icon: Target },
      { title: "Characters", url: "/characters", icon: Users },
      { title: "Locations", url: "/locations", icon: Map },
      { title: "Timeline", url: "/timeline", icon: Calendar },
      { title: "Scene Cards", url: "/scenes", icon: Bookmark },
    ],
  },
  {
    title: "Research",
    items: [
      { title: "Research", url: "/research", icon: FileText },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Export",
    items: [
      { title: "Export", url: "/export", icon: Download },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <BookOpen className="h-6 w-6" />
          <span className="font-semibold">Rogan Writer</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {navigationItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "w-full justify-start",
                          isActive && "bg-primary/10 text-primary"
                        )}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      
      <SidebarFooter>
        <div className="flex items-center justify-between px-2 py-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>
        </div>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
} 