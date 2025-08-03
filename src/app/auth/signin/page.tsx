"use client"

import { signIn } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Mail } from "lucide-react"

export default function SignInPage() {
  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: "/" })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-Cambria">little brother</CardTitle>
          <CardDescription>
            Sign in to your writing workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google OAuth */}
          <Button
            variant="outline"
            onClick={() => handleOAuthSignIn("google")}
            className="w-full"
          >
            <Mail className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 