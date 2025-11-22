import { prisma } from "@/lib/db"
import type { User, Prisma } from "@prisma/client"

export class UserService {
  static async getUserById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id }
    })
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email }
    })
  }

  static async createUser(data: {
    email: string
    name?: string
    theme?: string
    defaultBookFormat?: string
    dailyWordGoal?: number
  }): Promise<User> {
    return await prisma.user.create({
      data
    })
  }

  static async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data
    })
  }

  static async updateUserPreferences(id: string, preferences: {
    theme?: string
    defaultBookFormat?: string
    dailyWordGoal?: number
  }): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: preferences
    })
  }
} 