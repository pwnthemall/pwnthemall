import type { LucideIcon } from "lucide-react";
import { ChallengeCategory } from "./ChallengeCategory";

export interface NavSubItem {
  title: string;
  url: string;
}

export interface NavItem extends NavSubItem {
  icon?: LucideIcon;
  items?: NavSubItem[];
  isActive?: boolean;
  ariaLabel?: string;
  draggableItems?: ChallengeCategory[];
  onReorderItems?: (items: ChallengeCategory[]) => void;
}
