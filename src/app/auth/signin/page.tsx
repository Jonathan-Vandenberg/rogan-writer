"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Github, Mail } from "lucide-react"

export default function SignInPage() {
  const [email, setEmail] = useState("test@example.com")
  const [password, setPassword] = useState("password")
  const [loading, setLoading] = useState(false)

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn("credentials", { 
        email, 
        password,
        callbackUrl: "/" 
      })
    } catch (error) {
      console.error("Sign in error:", error)
    } finally {
      setLoading(false)
    }
  }

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
          <CardTitle className="text-2xl">Welcome to Rogan Writer</CardTitle>
          <CardDescription>
            Sign in to your writing workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Development Credentials */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* OAuth Providers */}
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn("github")}
              className="w-full"
            >
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn("google")}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>For development, use:</p>
            <p className="font-mono">test@example.com</p>
            <p>Any password works</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 