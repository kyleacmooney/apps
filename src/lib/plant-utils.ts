import {
  Droplets,
  Flower2,
  Wind,
  ArrowUpFromDot,
  Sparkles,
  Scissors,
} from 'lucide-react'
import type { CareType, PotMaterial, PotSize, LightLevel } from './plant-types'
import type { LucideIcon } from 'lucide-react'

export const CARE_TYPES: CareType[] = ['water', 'fertilize', 'mist', 'repot', 'clean', 'prune']

export const CARE_TYPE_CONFIG: Record<CareType, {
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
}> = {
  water: { label: 'Water', icon: Droplets, color: 'text-care-water', bgColor: 'bg-care-water/15' },
  fertilize: { label: 'Fertilize', icon: Flower2, color: 'text-care-fertilize', bgColor: 'bg-care-fertilize/15' },
  mist: { label: 'Mist', icon: Wind, color: 'text-care-mist', bgColor: 'bg-care-mist/15' },
  repot: { label: 'Repot', icon: ArrowUpFromDot, color: 'text-care-repot', bgColor: 'bg-care-repot/15' },
  clean: { label: 'Clean', icon: Sparkles, color: 'text-care-clean', bgColor: 'bg-care-clean/15' },
  prune: { label: 'Prune', icon: Scissors, color: 'text-care-prune', bgColor: 'bg-care-prune/15' },
}

export const POT_MATERIALS: { value: PotMaterial; label: string }[] = [
  { value: 'terracotta', label: 'Terracotta' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'wood', label: 'Wood' },
  { value: 'other', label: 'Other' },
]

export const POT_SIZES: { value: PotSize; label: string }[] = [
  { value: 'small', label: 'Small (< 6")' },
  { value: 'medium', label: 'Medium (6-10")' },
  { value: 'large', label: 'Large (10-14")' },
  { value: 'xlarge', label: 'Extra Large (14"+)' },
]

export const LIGHT_LEVELS: { value: LightLevel; label: string }[] = [
  { value: 'low', label: 'Low Light' },
  { value: 'medium', label: 'Medium Light' },
  { value: 'bright', label: 'Bright Indirect' },
  { value: 'full_sun', label: 'Full Sun' },
]

export const WATERING_ESTIMATE_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: 'Every 2-3 days (tropical)' },
  { value: 7, label: 'Weekly (most houseplants)' },
  { value: 14, label: 'Every 2 weeks (succulents)' },
  { value: 30, label: 'Monthly (cacti/drought-tolerant)' },
]

export function daysOverdue(nextDue: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(nextDue + 'T00:00:00')
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDueDate(nextDue: string): string {
  const days = daysOverdue(nextDue)
  if (days > 1) return `${days}d overdue`
  if (days === 1) return 'Yesterday'
  if (days === 0) return 'Today'
  if (days === -1) return 'Tomorrow'
  return `In ${Math.abs(days)}d`
}

export function pluralizeDays(days: number): string {
  if (days === 1) return 'every day'
  return `every ${days} days`
}
