export type CareType = 'water' | 'fertilize' | 'mist' | 'repot' | 'clean' | 'prune'
export type CareStatus = 'done' | 'skipped'
export type PotMaterial = 'terracotta' | 'plastic' | 'ceramic' | 'fabric' | 'wood' | 'other'
export type PotSize = 'small' | 'medium' | 'large' | 'xlarge'
export type LightLevel = 'low' | 'medium' | 'bright' | 'full_sun'

export interface Room {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Plant {
  id: string
  user_id: string
  room_id: string | null
  nickname: string
  species_common_name: string
  species_scientific_name: string | null
  species_thumbnail_url: string | null
  pot_material: PotMaterial | null
  pot_size: PotSize | null
  light_level: LightLevel | null
  notes: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
  rooms?: Room | null
}

export interface CareSchedule {
  id: string
  user_id: string
  plant_id: string
  care_type: CareType
  interval_days: number
  is_custom: boolean
  next_due: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CareLog {
  id: string
  user_id: string
  plant_id: string
  care_type: CareType
  status: CareStatus
  performed_at: string
  notes: string | null
  created_at: string
}

export interface SpeciesProfile {
  id: string
  user_id: string
  species_common_name: string
  species_scientific_name: string | null
  image_url: string | null
  watering_interval_days: number | null
  humidity_preference: 'low' | 'average' | 'high' | null
  temperature_min_f: number | null
  temperature_max_f: number | null
  dormancy_months: number[] | null
  fertilize_interval_days: number | null
  misting_needed: boolean | null
  care_summary: string | null
  common_problems: string | null
  propagation_tips: string | null
  seasonal_care_notes: string | null
  fun_facts: string | null
  updated_at: string
}

export interface TodoItem {
  id: string
  care_type: CareType
  next_due: string
  interval_days: number
  is_custom: boolean
  plants: {
    id: string
    nickname: string
    species_common_name: string
    species_thumbnail_url: string | null
    is_archived: boolean
    rooms: { name: string } | null
  }
}

