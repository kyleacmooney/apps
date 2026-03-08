import type { CareType, PotMaterial, PotSize, LightLevel } from './plant-types'

const POT_MATERIAL_MULTIPLIER: Record<PotMaterial, number> = {
  terracotta: 0.75,
  fabric: 0.80,
  wood: 0.85,
  ceramic: 1.0,
  plastic: 1.20,
  other: 1.0,
}

const POT_SIZE_MULTIPLIER: Record<PotSize, number> = {
  small: 0.70,
  medium: 1.0,
  large: 1.35,
  xlarge: 1.60,
}

const LIGHT_MULTIPLIER: Record<LightLevel, number> = {
  full_sun: 0.65,
  bright: 0.85,
  medium: 1.0,
  low: 1.30,
}

function getSeasonMultiplier(): number {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 0.85   // Spring
  if (month >= 5 && month <= 8) return 0.75   // Summer
  if (month >= 9 && month <= 10) return 1.15  // Fall
  return 1.30                                 // Winter
}

export function computeWateringInterval(
  baseIntervalDays: number,
  potMaterial: PotMaterial | null,
  potSize: PotSize | null,
  lightLevel: LightLevel | null,
): number {
  const mat = POT_MATERIAL_MULTIPLIER[potMaterial ?? 'ceramic']
  const size = POT_SIZE_MULTIPLIER[potSize ?? 'medium']
  const light = LIGHT_MULTIPLIER[lightLevel ?? 'medium']
  const season = getSeasonMultiplier()
  return Math.max(1, Math.round(baseIntervalDays * mat * size * light * season))
}

interface ScheduleDefaults {
  care_type: CareType
  interval_days: number
  is_enabled: boolean
  next_due: string
}

export function computeDefaultSchedules(
  baseIntervalDays: number,
  potMaterial: PotMaterial | null,
  potSize: PotSize | null,
  lightLevel: LightLevel | null,
  fertilizeOverride?: number | null,
  mistingNeeded?: boolean | null,
): ScheduleDefaults[] {
  const waterInterval = computeWateringInterval(baseIntervalDays, potMaterial, potSize, lightLevel)
  const today = new Date().toISOString().split('T')[0]

  const addDays = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  return [
    {
      care_type: 'water',
      interval_days: waterInterval,
      is_enabled: true,
      next_due: today, // due now — user just added the plant
    },
    {
      care_type: 'fertilize',
      interval_days: fertilizeOverride ?? Math.max(7, Math.round(waterInterval * 4)),
      is_enabled: true,
      next_due: addDays(fertilizeOverride ?? Math.round(waterInterval * 4)),
    },
    {
      care_type: 'mist',
      interval_days: Math.max(1, Math.round(waterInterval * 0.5)),
      is_enabled: mistingNeeded !== false && baseIntervalDays <= 7,
      next_due: addDays(Math.max(1, Math.round(waterInterval * 0.5))),
    },
    {
      care_type: 'repot',
      interval_days: 365,
      is_enabled: true,
      next_due: addDays(365),
    },
    {
      care_type: 'clean',
      interval_days: 30,
      is_enabled: true,
      next_due: addDays(30),
    },
    {
      care_type: 'prune',
      interval_days: 90,
      is_enabled: true,
      next_due: addDays(90),
    },
  ]
}
