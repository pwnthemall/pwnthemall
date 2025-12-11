import { Challenge } from "./Challenge"

export interface ChallengeType {
  id: number
  name: string
  instance?: boolean
  challenges?: any[]
}

export interface ChallengeTypeFormData {
  name: string
}
