"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, PenTool, Users, BarChart3, Target, Lightbulb } from "lucide-react"

interface DashboardData {
  books: {
    total: number
    active: number
    editing: number
  }
  writing: {
    totalWords: number
    streak: number
    todayWords: number
    weekWords: number
  }
  characters: {
    total: number
  }
  plot: {
    totalPoints: number
    completedPoints: number
    progressPercent: number
    plotStatus: Array<{
      type: string
      title: string
      completed: boolean
    }>
  }
  recentNotes: Array<{
    id: string
    title: string
    createdAt: string
    tags: string[]
  }>
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const data = await response.json()
          setDashboardData(data)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading your writing workspace...</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Unable to load dashboard data</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back to your writing workspace
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Words</CardTitle>
            <PenTool className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.writing.totalWords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.writing.todayWords} words today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Books</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.books.total}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.books.active} in progress, {dashboardData.books.editing} editing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Characters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.characters.total}</div>
            <p className="text-xs text-muted-foreground">
              Across all books
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Writing Streak</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.writing.streak} days</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.writing.streak > 0 ? 'Keep it up!' : 'Start your streak!'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Jump into your writing flow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" variant="default">
              Continue Writing
            </Button>
            <Button className="w-full" variant="outline">
              Start New Chapter
            </Button>
            <Button className="w-full" variant="outline">
              Add New Character
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Plot Progress
            </CardTitle>
            <CardDescription>
              Track your story structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.plot.plotStatus.length > 0 ? (
                dashboardData.plot.plotStatus.slice(0, 4).map((point, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{point.title}</span>
                    <span className={point.completed ? "text-green-600" : "text-gray-400"}>
                      {point.completed ? "✓" : "Pending"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No plot points yet</p>
              )}
              {dashboardData.plot.totalPoints > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{dashboardData.plot.progressPercent}%</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recent Ideas
            </CardTitle>
            <CardDescription>
              Your latest brainstorming notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {dashboardData.recentNotes.length > 0 ? (
                dashboardData.recentNotes.map((note, index) => {
                  const colors = ['blue', 'green', 'purple', 'orange', 'pink']
                  const color = colors[index % colors.length]
                  const timeAgo = new Date(note.createdAt).toLocaleDateString()
                  
                  return (
                    <div key={note.id} className={`border-l-2 border-${color}-500 pl-2`}>
                      <p className="font-medium">{note.title}</p>
                      <p className="text-muted-foreground text-xs">{timeAgo}</p>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">No ideas yet. Start brainstorming!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
