import { Challenge } from "./Challenge"
import { Team } from "./Team"

export interface Instance {
  id: number
  name: string
  userId: number
  teamId: number
  challengeId: number
  challenge: Challenge
  team: Team
  createdAt: string
}

export interface InstanceResponse {
  status: string
  image_name: string
  name: string
  connection_info?: string[]
} 