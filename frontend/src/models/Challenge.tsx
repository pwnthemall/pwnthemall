import { ChallengeCategory } from "./ChallengeCategory"
import { ChallengeDifficulty } from "./ChallengeDifficulty"
import { ChallengeType } from "./ChallengeType"
import { User } from "./User"
import { Team } from "./Team"

export interface Challenge {
  id: number
  slug: string
  name: string
  description: string
  challengeDifficulty: ChallengeDifficulty
  challengeDifficultyId: number
  challengeType: ChallengeType
  challengeTypeId: number
  challengeCategory: ChallengeCategory
  challengeCategoryId: number
  createdAt?: string
  updatedAt?: string
  solvers?: User[]
  author: string
  hidden?: boolean
  solved?: boolean
  files?: string[]
  ports?: number[]
  connectionInfo?: string[]
  geoRadiusKm?: number | null
  points?: number
  currentPoints?: number
  order?: number
  enableFirstBlood?: boolean
  firstBloodBonuses?: number[]
  firstBloodBadges?: string[]
  decayFormula?: {
    id: number
    name: string
    type: string
    step: number
    minPoints: number
  }
  decayFormulaId?: number
  hints?: {
    id: number
    title?: string
    content: string
    cost: number
    challengeId: number
    purchased?: boolean
  }[]
  maxAttempts?: number
  teamFailedAttempts?: number
  dependsOn?: string
  locked?: boolean
  coverImg?: string
  emoji?: string
  coverPositionX?: number  // 0-100, supports decimals
  coverPositionY?: number  // 0-100, supports decimals
  coverZoom?: number       // 100-200, default 100 (no zoom)
}

export interface FirstBlood {
  id: number
  challengeId: number
  teamId: number
  userId: number
  bonuses: number[]
  badges: string[]
  createdAt: string
  updatedAt: string
}

export interface Solve {
  teamId: number
  team: Team
  challengeId: number
  challenge: Challenge
  points: number // Historical points when solved
  currentPoints: number // Current decayed points of the challenge
  createdAt: string
  userId?: number
  username?: string
  firstBlood?: FirstBlood
}
