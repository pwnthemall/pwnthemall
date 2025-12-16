import { Challenge } from "./Challenge"

export interface ChallengeDifficulty {
  id: number
  name: string
  color: string // HEX color code (e.g., #22c55e)
  challenges?: Challenge[]
}

export interface ChallengeDifficultyFormData {
  name: string
  color: string // HEX color code
}
