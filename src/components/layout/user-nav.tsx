"use client"

import * as React from "react"
import { LogOut, Settings, User } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserNav() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <Button variant="ghost" className="relative h-8 w-8 rounded-full" disabled>
        <Avatar className="h-8 w-8">
          <AvatarFallback>...</AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <Button variant="ghost" className="relative h-8 w-8 rounded-full" disabled>
        <Avatar className="h-8 w-8">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  const user = session.user
  const initials = user.name 
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : (user.email?.substring(0, 2).toUpperCase() || 'U')

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || ""} alt={user.name || 'User'} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || 'Writer'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email || 'No email'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 