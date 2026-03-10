import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePersistedState } from '@/lib/use-persisted-state'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataClient } from '@/context/SupabaseContext'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { computeDefaultSchedules } from '@/lib/plant-care-algorithm'
import {
  CARE_TYPE_CONFIG,
  POT_MATERIALS,
  POT_SIZES,
  LIGHT_LEVELS,
  WATERING_ESTIMATE_OPTIONS,
  daysOverdue,
  formatDueDate,
  pluralizeDays,
} from '@/lib/plant-utils'
import type {
  Plant,
  Room,
  CareSchedule,
  CareLog,
  CareType,
  TodoItem,
  PotMaterial,
  PotSize,
  LightLevel,
  SpeciesProfile,
} from '@/lib/plant-types'
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Check,
  SkipForward,
  Sprout,
  ChevronRight,
  X,
  Search,
  Pencil,
  Archive,
  Leaf,
  Home,
  Camera,
  Loader2,
  Undo2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// ─── Query select strings ──────────────────────────────────────

const TODO_SELECT = `
  id, care_type, next_due, interval_days, is_custom,
  plants!inner (
    id, nickname, species_common_name, species_thumbnail_url, is_archived,
    rooms ( name )
  )
`

const PLANT_SELECT = `
  id, user_id, room_id, nickname, species_common_name, species_scientific_name,
  species_thumbnail_url,
  pot_material, pot_size, light_level, notes, is_archived, created_at, updated_at,
  rooms ( id, name )
`

// ─── Helpers ──────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function addDaysStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getRelativeDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface HistoryLogEntry {
  id: string
  care_type: CareType
  status: string
  performed_at: string
  plant_id: string
  plants: {
    id: string
    nickname: string
    species_thumbnail_url: string | null
    is_archived: boolean
  }
}

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to resize image'))),
        'image/webp',
        0.8,
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}
// ─── Sub-components ──────────────────────────────────────

function TodoCard({
  item,
  onDone,
  onSkip,
  isPending,
}: {
  item: TodoItem
  onDone: () => void
  onSkip: () => void
  isPending: boolean
}) {
  const config = CARE_TYPE_CONFIG[item.care_type]
  const Icon = config.icon
  const overdue = daysOverdue(item.next_due)

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl bg-bg-secondary border border-border-default transition-all duration-200',
        isPending && 'opacity-50 scale-[0.98]',
      )}
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', config.bgColor)}>
        <Icon className={cn('w-4.5 h-4.5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {item.plants.nickname}
          </span>
          {item.plants.rooms && (
            <span className="text-xs text-text-dim truncate">
              {item.plants.rooms.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          <span
            className={cn(
              'text-xs font-mono',
              overdue > 0 ? 'text-red-400' : 'text-text-muted',
            )}
          >
            {formatDueDate(item.next_due)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onSkip}
          disabled={isPending}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-dim hover:text-text-muted hover:bg-bg-elevated transition-colors cursor-pointer"
          title="Skip"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDone}
          disabled={isPending}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-plant/15 text-plant hover:bg-plant/25 transition-colors cursor-pointer"
          title="Done"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function PlantCard({
  plant,
  onClick,
}: {
  plant: Plant
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-bg-secondary border border-border-default hover:border-border-hover transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {plant.species_thumbnail_url ? (
          <img
            src={plant.species_thumbnail_url}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-plant-bg flex items-center justify-center shrink-0">
            <Leaf className="w-5 h-5 text-plant" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {plant.nickname}
          </p>
          <p className="text-xs text-text-muted truncate">
            {plant.species_common_name}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-text-dim shrink-0" />
      </div>
    </button>
  )
}

function RoomSection({
  room,
  plants,
  onPlantClick,
  onEditRoom,
}: {
  room: Room | null
  plants: Plant[]
  onPlantClick: (plant: Plant) => void
  onEditRoom?: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Home className="w-3.5 h-3.5 text-text-dim" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            {room?.name ?? 'No Room'}
          </h3>
        </div>
        {room && onEditRoom && (
          <button
            onClick={onEditRoom}
            className="text-text-dim hover:text-text-muted transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
      {plants.length === 0 ? (
        <p className="text-xs text-text-dim px-1 italic">No plants in this room</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {plants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} onClick={() => onPlantClick(plant)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add Plant Dialog ──────────────────────────────────────

function AddPlantDialog({
  open,
  onOpenChange,
  rooms,
  userId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: Room[]

  userId: string
  onSuccess: () => void
}) {
  const supabase = useDataClient()
  const queryClient = useQueryClient()

  // Form state (persisted so partial input survives iOS app suspension)
  const [nickname, setNickname] = usePersistedState('plants:form:nickname', '')
  const [speciesName, setSpeciesName] = usePersistedState('plants:form:speciesName', '')
  const [scientificName, setScientificName] = usePersistedState('plants:form:scientificName', '')
  const [wateringEstimate, setWateringEstimate] = usePersistedState('plants:form:wateringEstimate', 7)
  const [profileWatering, setProfileWatering] = usePersistedState<number | null>('plants:form:profileWatering', null)
  const [profileMisting, setProfileMisting] = usePersistedState<boolean | null>('plants:form:profileMisting', null)
  const [roomId, setRoomId] = usePersistedState('plants:form:roomId', '__none__')
  const [potMaterial, setPotMaterial] = usePersistedState<PotMaterial>('plants:form:potMaterial', 'ceramic')
  const [potSize, setPotSize] = usePersistedState<PotSize>('plants:form:potSize', 'medium')
  const [lightLevel, setLightLevel] = usePersistedState<LightLevel>('plants:form:lightLevel', 'medium')

  // Species autocomplete
  const [speciesQuery, setSpeciesQuery] = usePersistedState('plants:form:speciesQuery', '')
  const [debouncedSpeciesQuery, setDebouncedSpeciesQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSpeciesQuery(speciesQuery), 300)
    return () => clearTimeout(t)
  }, [speciesQuery])

  const { data: speciesSuggestions = [], isFetching: isSearching } = useQuery({
    queryKey: ['species-profiles', 'search', debouncedSpeciesQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from('species_profiles')
        .select('species_common_name, species_scientific_name, image_url, watering_interval_days, misting_needed')
        .ilike('species_common_name', `%${debouncedSpeciesQuery}%`)
        .limit(8)
      return data ?? []
    },
    enabled: debouncedSpeciesQuery.length >= 2,
    staleTime: 60_000,
  })

  function selectProfile(profile: typeof speciesSuggestions[number]) {
    setSpeciesName(profile.species_common_name)
    setScientificName(profile.species_scientific_name ?? '')
    setProfileWatering(profile.watering_interval_days)
    setProfileMisting(profile.misting_needed)
    if (!nickname) setNickname(profile.species_common_name)
    setSpeciesQuery(profile.species_common_name)
    setShowSuggestions(false)
  }

  const createPlant = useMutation({
    mutationFn: async () => {
      const baseInterval = profileWatering ?? wateringEstimate

      const { data: plant, error } = await supabase
        .from('plants')
        .insert({
          user_id: userId,
          room_id: roomId === '__none__' ? null : roomId,
          nickname: nickname.trim(),
          species_common_name: speciesName.trim() || nickname.trim(),
          species_scientific_name: scientificName || null,
          pot_material: potMaterial,
          pot_size: potSize,
          light_level: lightLevel,
        })
        .select()
        .single()
      if (error) throw error

      const schedules = computeDefaultSchedules(baseInterval, potMaterial, potSize, lightLevel, null, profileMisting)
      const { error: schedError } = await supabase
        .from('care_schedules')
        .insert(
          schedules.map((s) => ({
            user_id: userId,
            plant_id: plant.id,
            care_type: s.care_type,
            interval_days: s.interval_days,
            is_enabled: s.is_enabled,
            next_due: s.next_due,
          })),
        )
      if (schedError) throw schedError
      return plant
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      resetForm()
      onOpenChange(false)
      onSuccess()
    },
  })

  function resetForm() {
    setNickname('')
    setSpeciesName('')
    setScientificName('')
    setWateringEstimate(7)
    setProfileWatering(null)
    setProfileMisting(null)
    setRoomId('__none__')
    setPotMaterial('ceramic')
    setPotSize('medium')
    setLightLevel('medium')
    setSpeciesQuery('')
    setDebouncedSpeciesQuery('')
    setShowSuggestions(false)
  }

  const canSubmit = nickname.trim() && speciesName.trim()

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="bg-bg-secondary border-border-default text-text-primary max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Add Plant</DialogTitle>
          <DialogDescription className="text-text-muted text-sm">
            Enter your plant&apos;s species and details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Species name with autocomplete */}
          <div ref={searchRef} className="relative">
            <Label className="text-text-muted text-xs mb-1.5 block">Species</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
              <Input
                value={speciesQuery}
                onChange={(e) => {
                  setSpeciesQuery(e.target.value)
                  setSpeciesName(e.target.value)
                  setProfileWatering(null)
                  setProfileMisting(null)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Monstera, Pothos, Snake Plant..."
                className="pl-9 bg-bg-elevated border-border-default text-text-primary placeholder:text-text-dim"
              />
            </div>
            {showSuggestions && debouncedSpeciesQuery.length >= 2 && speciesSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-bg-elevated border border-border-default rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-text-muted text-sm">Searching...</div>
                ) : (
                  speciesSuggestions.map((profile) => (
                    <button
                      key={profile.species_common_name}
                      onClick={() => selectProfile(profile)}
                      className="w-full text-left px-3 py-2 hover:bg-bg-secondary transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      {profile.image_url ? (
                        <img
                          src={profile.image_url}
                          alt=""
                          className="w-8 h-8 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-plant-bg flex items-center justify-center shrink-0">
                          <Leaf className="w-4 h-4 text-plant" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary truncate">{profile.species_common_name}</p>
                        <p className="text-xs text-text-muted truncate">{profile.species_scientific_name}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Watering estimate (shown when no species profile matched) */}
          {profileWatering === null && (
            <div>
              <Label className="text-text-muted text-xs mb-1.5 block">Watering Estimate</Label>
              <Select value={String(wateringEstimate)} onValueChange={(v) => setWateringEstimate(Number(v))}>
                <SelectTrigger className="bg-bg-elevated border-border-default text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-elevated border-border-default">
                  {WATERING_ESTIMATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)} className="text-text-primary">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator className="bg-border-default" />

          {/* Nickname */}
          <div>
            <Label className="text-text-muted text-xs mb-1.5 block">Nickname</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Give your plant a name"
              className="bg-bg-elevated border-border-default text-text-primary placeholder:text-text-dim"
            />
          </div>

          {/* Room */}
          <div>
            <Label className="text-text-muted text-xs mb-1.5 block">Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger className="bg-bg-elevated border-border-default text-text-primary">
                <SelectValue placeholder="Select room (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-bg-elevated border-border-default">
                <SelectItem value="__none__" className="text-text-muted">No room</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id} className="text-text-primary">
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pot info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-text-muted text-xs mb-1.5 block">Pot Material</Label>
              <Select value={potMaterial} onValueChange={(v) => setPotMaterial(v as PotMaterial)}>
                <SelectTrigger className="bg-bg-elevated border-border-default text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-elevated border-border-default">
                  {POT_MATERIALS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-text-primary">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-text-muted text-xs mb-1.5 block">Pot Size</Label>
              <Select value={potSize} onValueChange={(v) => setPotSize(v as PotSize)}>
                <SelectTrigger className="bg-bg-elevated border-border-default text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-elevated border-border-default">
                  {POT_SIZES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-text-primary">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Light level */}
          <div>
            <Label className="text-text-muted text-xs mb-1.5 block">Light Level</Label>
            <Select value={lightLevel} onValueChange={(v) => setLightLevel(v as LightLevel)}>
              <SelectTrigger className="bg-bg-elevated border-border-default text-text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-elevated border-border-default">
                {LIGHT_LEVELS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-text-primary">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <button
            onClick={() => createPlant.mutate()}
            disabled={!canSubmit || createPlant.isPending}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
              canSubmit
                ? 'bg-plant text-bg-primary hover:bg-plant/90'
                : 'bg-bg-elevated text-text-dim cursor-not-allowed',
            )}
          >
            {createPlant.isPending ? 'Adding...' : 'Add Plant'}
          </button>

          {createPlant.isError && (
            <p className="text-red-400 text-xs text-center">
              Failed to add plant. Please try again.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Room Dialog ──────────────────────────────────────

function RoomDialog({
  open,
  onOpenChange,
  room,
  userId,
  existingRooms,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Room | null
  userId: string
  existingRooms: Room[]
}) {
  const supabase = useDataClient()
  const queryClient = useQueryClient()
  const [name, setName] = useState(room?.name ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(room?.name ?? '')
    setError('')
  }, [room, open])

  const isDuplicate = existingRooms.some(
    (r) => r.id !== room?.id && r.name.trim().toLowerCase() === name.trim().toLowerCase()
  )

  const upsertRoom = useMutation({
    mutationFn: async () => {
      if (isDuplicate) {
        throw new Error('A room with this name already exists')
      }
      if (room) {
        const { error } = await supabase
          .from('rooms')
          .update({ name: name.trim() })
          .eq('id', room.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert({ user_id: userId, name: name.trim() })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      onOpenChange(false)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const deleteRoom = useMutation({
    mutationFn: async () => {
      if (!room) return
      const { error } = await supabase.from('rooms').delete().eq('id', room.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border-border-default text-text-primary max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {room ? 'Edit Room' : 'Add Room'}
          </DialogTitle>
          <DialogDescription className="text-text-muted text-sm">
            {room ? 'Rename or delete this room.' : 'Create a room to organize your plants.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name"
            className="bg-bg-elevated border-border-default text-text-primary placeholder:text-text-dim"
            autoFocus
          />
          {isDuplicate && (
            <p className="text-red-400 text-xs">A room with this name already exists.</p>
          )}
          {error && !isDuplicate && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
          <div className="flex gap-2">
            {room && (
              <button
                onClick={() => deleteRoom.mutate()}
                className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => upsertRoom.mutate()}
              disabled={!name.trim() || isDuplicate || upsertRoom.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-plant text-bg-primary hover:bg-plant/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {room ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Plant Detail Bottom Sheet ──────────────────────────────────

function PlantDetailSheet({
  plant,
  visible,
  onClose,
  rooms,
}: {
  plant: Plant | null
  visible: boolean
  onClose: () => void
  rooms: Room[]
}) {
  const supabase = useDataClient()
  const queryClient = useQueryClient()
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)
  const [editInterval, setEditInterval] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const resized = await resizeImage(file, 512)
      const path = `${plant!.user_id}/${plant!.id}.webp`

      const { error: uploadError } = await supabase.storage
        .from('plant-photos')
        .upload(path, resized, { upsert: true, contentType: 'image/webp' })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('plant-photos')
        .getPublicUrl(path)

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('plants')
        .update({ species_thumbnail_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', plant!.id)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadPhoto.mutate(file)
    e.target.value = ''
  }

  const updateRoom = useMutation({
    mutationFn: async (roomId: string | null) => {
      const { error } = await supabase
        .from('plants')
        .update({ room_id: roomId, updated_at: new Date().toISOString() })
        .eq('id', plant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })

  const { data: schedules = [] } = useQuery({
    queryKey: ['plants', 'care-schedules', plant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('care_schedules')
        .select('*')
        .eq('plant_id', plant!.id)
        .order('care_type')
      return (data ?? []) as CareSchedule[]
    },
    enabled: !!plant,
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['plants', 'care-logs', plant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('care_logs')
        .select('*')
        .eq('plant_id', plant!.id)
        .order('performed_at', { ascending: false })
        .limit(20)
      return (data ?? []) as CareLog[]
    },
    enabled: !!plant,
  })

  const { data: speciesProfile } = useQuery({
    queryKey: ['species-profiles', plant?.species_common_name],
    queryFn: async () => {
      const { data } = await supabase
        .from('species_profiles')
        .select('*')
        .eq('species_common_name', plant!.species_common_name)
        .maybeSingle()
      return data as SpeciesProfile | null
    },
    enabled: !!plant,
  })

  const toggleEnabled = useMutation({
    mutationFn: async ({ scheduleId, enabled }: { scheduleId: string; enabled: boolean }) => {
      await supabase
        .from('care_schedules')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', scheduleId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-schedules', plant?.id] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'todo'] })
    },
  })

  const updateInterval = useMutation({
    mutationFn: async ({ scheduleId, days }: { scheduleId: string; days: number }) => {
      await supabase
        .from('care_schedules')
        .update({
          interval_days: days,
          is_custom: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduleId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-schedules', plant?.id] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'todo'] })
      setEditingSchedule(null)
    },
  })

  const archivePlant = useMutation({
    mutationFn: async () => {
      await supabase
        .from('plants')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', plant!.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      onClose()
    },
  })

  const undoCareLog = useMutation({
    mutationFn: async ({ logId, careType }: { logId: string; careType: CareType }) => {
      await supabase.from('care_logs').delete().eq('id', logId)

      const { data: schedule } = await supabase
        .from('care_schedules')
        .select('id, interval_days')
        .eq('plant_id', plant!.id)
        .eq('care_type', careType)
        .single()
      if (!schedule) return

      const { data: lastLog } = await supabase
        .from('care_logs')
        .select('performed_at')
        .eq('plant_id', plant!.id)
        .eq('care_type', careType)
        .order('performed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const newNextDue = lastLog
        ? (() => {
            const d = new Date(lastLog.performed_at)
            d.setDate(d.getDate() + schedule.interval_days)
            return d.toISOString().split('T')[0]
          })()
        : todayStr()

      await supabase
        .from('care_schedules')
        .update({ next_due: newNextDue, updated_at: new Date().toISOString() })
        .eq('id', schedule.id)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', 'todo'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-logs'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-schedules'] })
    },
  })

  if (!plant) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-lg bg-bg-secondary rounded-t-2xl border-t border-x border-border-default max-h-[80vh] flex flex-col transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-text-dim/30" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 border-b border-border-default">
          <div className="flex items-center gap-3">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadPhoto.isPending}
              className="relative w-12 h-12 shrink-0 cursor-pointer group"
            >
              {(plant.species_thumbnail_url ?? speciesProfile?.image_url) ? (
                <img src={(plant.species_thumbnail_url ?? speciesProfile?.image_url)!} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-plant-bg flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-plant" />
                </div>
              )}
              <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                {uploadPhoto.isPending ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-text-primary truncate">{plant.nickname}</h2>
              <p className="text-sm text-text-muted truncate">{plant.species_common_name}</p>
            </div>
            <button onClick={onClose} className="text-text-dim hover:text-text-muted transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Plant info chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <Select
              value={plant.room_id ?? '__none__'}
              onValueChange={(v) => updateRoom.mutate(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="h-auto text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted border-none gap-1 w-auto">
                <Home className="w-3 h-3 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-elevated border-border-default">
                <SelectItem value="__none__" className="text-text-muted text-xs">No room</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-text-primary text-xs">
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plant.pot_material && (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted capitalize">
                {plant.pot_material}
              </span>
            )}
            {plant.pot_size && (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted capitalize">
                {plant.pot_size}
              </span>
            )}
            {plant.light_level && (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted capitalize">
                {plant.light_level.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* Species research (from Claude.ai) */}
          {speciesProfile?.care_summary ? (
            <div className="px-5 py-3 border-b border-border-default">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Research Notes</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{speciesProfile.care_summary}</p>
              {speciesProfile.common_problems && (
                <div className="mt-2">
                  <span className="text-xs font-medium text-text-muted">Common Problems: </span>
                  <span className="text-xs text-text-secondary">{speciesProfile.common_problems}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-3 border-b border-border-default">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-plant-bg/30 border border-plant/10">
                <Sprout className="w-4 h-4 text-plant mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-text-secondary">
                    No species research yet. Ask Claude to research <span className="font-medium text-text-primary">{plant.species_common_name}</span> for care tips, a reference image, and optimized schedules.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Care schedules */}
          <div className="px-5 py-3 border-b border-border-default">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Care Schedule</h3>
            <div className="space-y-2">
              {schedules.map((schedule) => {
                const config = CARE_TYPE_CONFIG[schedule.care_type]
                const Icon = config.icon
                const isEditing = editingSchedule === schedule.id
                return (
                  <div key={schedule.id} className={cn('flex items-center gap-3 py-1.5', !schedule.is_enabled && 'opacity-40')}>
                    <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', config.bgColor)}>
                      <Icon className={cn('w-3.5 h-3.5', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-text-primary">{config.label}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-text-muted">Every</span>
                          <input
                            type="number"
                            value={editInterval}
                            onChange={(e) => setEditInterval(e.target.value)}
                            className="w-16 px-1.5 py-0.5 text-base bg-bg-elevated border border-border-default rounded text-text-primary text-center"
                            min={1}
                            autoFocus
                          />
                          <span className="text-xs text-text-muted">days</span>
                          <button
                            onClick={() => {
                              const days = parseInt(editInterval)
                              if (days >= 1) updateInterval.mutate({ scheduleId: schedule.id, days })
                            }}
                            className="text-plant text-xs font-medium cursor-pointer ml-1"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSchedule(null)}
                            className="text-text-dim text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingSchedule(schedule.id)
                            setEditInterval(String(schedule.interval_days))
                          }}
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer block"
                        >
                          {pluralizeDays(schedule.interval_days)}
                          {schedule.is_custom && ' (custom)'}
                          {' · '}
                          {formatDueDate(schedule.next_due)}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => toggleEnabled.mutate({ scheduleId: schedule.id, enabled: !schedule.is_enabled })}
                      className={cn(
                        'text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer shrink-0',
                        schedule.is_enabled
                          ? 'bg-plant/15 text-plant'
                          : 'bg-bg-elevated text-text-dim',
                      )}
                    >
                      {schedule.is_enabled ? 'Active' : 'Paused'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Care history */}
          <div className="px-5 py-3 border-b border-border-default">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Recent History</h3>
            {logs.length === 0 ? (
              <p className="text-sm text-text-dim">No care logged yet</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => {
                  const config = CARE_TYPE_CONFIG[log.care_type]
                  const Icon = config.icon
                  const date = new Date(log.performed_at)
                  return (
                    <div key={log.id} className="flex items-center gap-2.5 py-1.5">
                      <Icon className={cn('w-3.5 h-3.5 shrink-0', config.color)} />
                      <span className="text-xs text-text-secondary flex-1">
                        {config.label}
                        {log.status === 'skipped' && (
                          <span className="text-text-dim ml-1">(skipped)</span>
                        )}
                      </span>
                      <span className="text-xs font-mono text-text-dim">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        onClick={() => undoCareLog.mutate({ logId: log.id, careType: log.care_type })}
                        disabled={undoCareLog.isPending}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-dim hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer shrink-0"
                        title="Undo"
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pt-4 pb-10">
            <button
              onClick={() => archivePlant.mutate()}
              disabled={archivePlant.isPending}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              Archive Plant
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Plants Component ──────────────────────────────────

export function Plants() {
  const supabase = useDataClient()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''

  // UI state
  const [activeTab, setActiveTab] = usePersistedState('plants:activeTab', 'todo')
  const [addPlantOpen, setAddPlantOpen] = usePersistedState('plants:addPlantOpen', false)
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Plant detail sheet state (mount/unmount animation)
  const [selectedPlantId, setSelectedPlantId] = usePersistedState<string | null>('plants:selectedPlantId', null)
  const [sheetMountedId, setSheetMountedId] = useState<string | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const sheetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Optimistic: track items being marked done/skipped
  const [pendingCareIds, setPendingCareIds] = useState<Set<string>>(new Set())

  // Undo toast state
  const [undoInfo, setUndoInfo] = useState<{
    careLogId: string
    scheduleId: string
    previousNextDue: string
    label: string
  } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(sheetTimerRef.current)
    if (selectedPlantId) {
      setSheetMountedId(selectedPlantId)
      requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)))
    } else {
      setSheetVisible(false)
      sheetTimerRef.current = setTimeout(() => setSheetMountedId(null), 300)
    }
  }, [selectedPlantId])

  useEffect(() => {
    if (sheetMountedId) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [sheetMountedId])

  const closeSheet = useCallback(() => setSelectedPlantId(null), [])

  // ─── Queries ──────────────────────────────────────

  const { data: todoItems = [], isLoading: todoLoading } = useQuery({
    queryKey: ['plants', 'todo'],
    queryFn: async () => {
      const cutoff = addDaysStr(3)
      const { data, error } = await supabase
        .from('care_schedules')
        .select(TODO_SELECT)
        .lte('next_due', cutoff)
        .eq('is_enabled', true)
        .order('next_due', { ascending: true })

      if (error) throw error
      // Filter out archived plants — cast through unknown since Supabase
      // returns untyped data without generated DB types
      return ((data ?? []) as unknown as TodoItem[]).filter((item) => !item.plants.is_archived)
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: plants = [], isLoading: plantsLoading } = useQuery({
    queryKey: ['plants', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plants')
        .select(PLANT_SELECT)
        .eq('is_archived', false)
        .order('nickname')
      if (error) throw error
      return (data ?? []) as unknown as Plant[]
    },
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as Room[]
    },
  })

  const { data: historyLogs = [], isLoading: historyLoading } = useQuery({
    queryKey: ['plants', 'care-logs', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('care_logs')
        .select(`
          id, care_type, status, performed_at, plant_id,
          plants!inner (id, nickname, species_thumbnail_url, is_archived)
        `)
        .order('performed_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return ((data ?? []) as unknown as HistoryLogEntry[]).filter((log) => !log.plants.is_archived)
    },
    enabled: activeTab === 'history',
  })

  // ─── Mutations ──────────────────────────────────────

  const logCare = useMutation({
    mutationFn: async ({
      scheduleId,
      plantId,
      careType,
      status,
      previousNextDue,
      plantNickname,
    }: {
      scheduleId: string
      plantId: string
      careType: CareType
      status: 'done' | 'skipped'
      previousNextDue: string
      plantNickname: string
    }) => {
      const { data: logData, error: logErr } = await supabase.from('care_logs').insert({
        user_id: userId,
        plant_id: plantId,
        care_type: careType,
        status,
      }).select('id').single()
      if (logErr) throw logErr

      const { data: schedule } = await supabase
        .from('care_schedules')
        .select('interval_days')
        .eq('id', scheduleId)
        .single()

      const intervalDays = schedule?.interval_days ?? 7
      const nextDue = new Date()
      nextDue.setDate(nextDue.getDate() + intervalDays)

      const { error: updateErr } = await supabase
        .from('care_schedules')
        .update({
          next_due: nextDue.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduleId)
      if (updateErr) throw updateErr

      return { careLogId: logData.id, scheduleId, previousNextDue, plantNickname, careType }
    },
    onSuccess: (result) => {
      if (result) {
        clearTimeout(undoTimerRef.current)
        setUndoInfo({
          careLogId: result.careLogId,
          scheduleId: result.scheduleId,
          previousNextDue: result.previousNextDue,
          label: `${CARE_TYPE_CONFIG[result.careType].label} · ${result.plantNickname}`,
        })
        undoTimerRef.current = setTimeout(() => setUndoInfo(null), 5000)
      }
    },
    onMutate: ({ scheduleId }) => {
      setPendingCareIds((prev) => new Set(prev).add(scheduleId))
    },
    onSettled: (_data, _err, { scheduleId }) => {
      setPendingCareIds((prev) => {
        const next = new Set(prev)
        next.delete(scheduleId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['plants', 'todo'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-logs'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-schedules'] })
    },
  })

  const undoCare = useMutation({
    mutationFn: async ({ careLogId, scheduleId, previousNextDue }: {
      careLogId: string
      scheduleId: string
      previousNextDue: string
    }) => {
      await supabase.from('care_logs').delete().eq('id', careLogId)
      await supabase
        .from('care_schedules')
        .update({ next_due: previousNextDue, updated_at: new Date().toISOString() })
        .eq('id', scheduleId)
    },
    onSuccess: () => {
      clearTimeout(undoTimerRef.current)
      setUndoInfo(null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', 'todo'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-logs'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-schedules'] })
    },
  })

  const undoHistoryLog = useMutation({
    mutationFn: async ({ logId, plantId, careType }: { logId: string; plantId: string; careType: CareType }) => {
      await supabase.from('care_logs').delete().eq('id', logId)

      const { data: schedule } = await supabase
        .from('care_schedules')
        .select('id, interval_days')
        .eq('plant_id', plantId)
        .eq('care_type', careType)
        .single()
      if (!schedule) return

      const { data: lastLog } = await supabase
        .from('care_logs')
        .select('performed_at')
        .eq('plant_id', plantId)
        .eq('care_type', careType)
        .order('performed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const newNextDue = lastLog
        ? (() => {
            const d = new Date(lastLog.performed_at)
            d.setDate(d.getDate() + schedule.interval_days)
            return d.toISOString().split('T')[0]
          })()
        : todayStr()

      await supabase
        .from('care_schedules')
        .update({ next_due: newNextDue, updated_at: new Date().toISOString() })
        .eq('id', schedule.id)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['plants', 'todo'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-logs'] })
      queryClient.invalidateQueries({ queryKey: ['plants', 'care-schedules'] })
    },
  })

  function handleCareDone(item: TodoItem) {
    logCare.mutate({
      scheduleId: item.id,
      plantId: item.plants.id,
      careType: item.care_type,
      status: 'done',
      previousNextDue: item.next_due,
      plantNickname: item.plants.nickname,
    })
  }

  function handleCareSkip(item: TodoItem) {
    logCare.mutate({
      scheduleId: item.id,
      plantId: item.plants.id,
      careType: item.care_type,
      status: 'skipped',
      previousNextDue: item.next_due,
      plantNickname: item.plants.nickname,
    })
  }

  // ─── Derived data ──────────────────────────────────────

  const today = todayStr()

  const todoGrouped = useMemo(() => {
    const overdue: TodoItem[] = []
    const dueToday: TodoItem[] = []
    const upcoming: TodoItem[] = []
    for (const item of todoItems) {
      if (item.next_due < today) overdue.push(item)
      else if (item.next_due === today) dueToday.push(item)
      else upcoming.push(item)
    }
    return { overdue, dueToday, upcoming }
  }, [todoItems, today])

  const plantsByRoom = useMemo(() => {
    const grouped = new Map<string | null, Plant[]>()
    for (const plant of plants) {
      const key = plant.room_id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(plant)
    }
    return grouped
  }, [plants])

  const historyGrouped = useMemo(() => {
    const groups: { label: string; logs: HistoryLogEntry[] }[] = []
    let currentLabel = ''
    for (const log of historyLogs) {
      const label = getRelativeDateLabel(log.performed_at)
      if (label !== currentLabel) {
        currentLabel = label
        groups.push({ label, logs: [] })
      }
      groups[groups.length - 1].logs.push(log)
    }
    return groups
  }, [historyLogs])

  const selectedPlant = useMemo(
    () => plants.find((p) => p.id === sheetMountedId) ?? null,
    [plants, sheetMountedId],
  )

  async function handleRefresh() {
    setIsRefreshing(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['plants'] }),
      queryClient.invalidateQueries({ queryKey: ['rooms'] }),
    ])
    setIsRefreshing(false)
  }

  // ─── Loading state ──────────────────────────────────

  const isLoading = activeTab === 'todo' ? todoLoading : activeTab === 'my-plants' ? plantsLoading : historyLoading

  if (isLoading && !todoItems.length && !plants.length) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-border-default border-t-plant rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Render ──────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary select-none">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border-default bg-bg-primary/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-text-dim hover:text-text-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-plant" />
                <h1 className="text-lg font-semibold text-text-primary">Plants</h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRefresh}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-dim hover:text-text-muted hover:bg-bg-secondary transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={cn('w-4 h-4', isRefreshing && 'animate-spin')}
                />
              </button>
              <button
                onClick={() => setAddPlantOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-plant/15 text-plant hover:bg-plant/25 transition-colors cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-bg-elevated rounded-lg p-1">
            <button
              onClick={() => setActiveTab('todo')}
              className={cn(
                'flex-1 text-sm font-medium py-1.5 rounded-md transition-all cursor-pointer',
                activeTab === 'todo'
                  ? 'bg-bg-secondary text-text-primary shadow-sm'
                  : 'text-text-dim hover:text-text-muted',
              )}
            >
              To-Do
              {todoGrouped.overdue.length + todoGrouped.dueToday.length > 0 && (
                <span className="ml-1.5 text-xs font-mono bg-plant/20 text-plant px-1.5 py-0.5 rounded-full">
                  {todoGrouped.overdue.length + todoGrouped.dueToday.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my-plants')}
              className={cn(
                'flex-1 text-sm font-medium py-1.5 rounded-md transition-all cursor-pointer',
                activeTab === 'my-plants'
                  ? 'bg-bg-secondary text-text-primary shadow-sm'
                  : 'text-text-dim hover:text-text-muted',
              )}
            >
              My Plants
              {plants.length > 0 && (
                <span className="ml-1.5 text-xs font-mono text-text-dim">
                  {plants.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                'flex-1 text-sm font-medium py-1.5 rounded-md transition-all cursor-pointer',
                activeTab === 'history'
                  ? 'bg-bg-secondary text-text-primary shadow-sm'
                  : 'text-text-dim hover:text-text-muted',
              )}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {activeTab === 'todo' && (
          <div className="space-y-5">
            {todoItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-plant-bg flex items-center justify-center mb-4">
                  <Sprout className="w-8 h-8 text-plant" />
                </div>
                <p className="text-text-muted text-sm font-medium mb-1">All caught up!</p>
                <p className="text-text-dim text-xs">
                  {plants.length === 0
                    ? 'Add your first plant to get started'
                    : 'No care tasks due in the next 3 days'}
                </p>
              </div>
            ) : (
              <>
                {todoGrouped.overdue.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400 px-1">
                      Overdue ({todoGrouped.overdue.length})
                    </h2>
                    {todoGrouped.overdue.map((item) => (
                      <TodoCard
                        key={item.id}
                        item={item}
                        isPending={pendingCareIds.has(item.id)}
                        onDone={() => handleCareDone(item)}
                        onSkip={() => handleCareSkip(item)}
                      />
                    ))}
                  </div>
                )}
                {todoGrouped.dueToday.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-plant px-1">
                      Today ({todoGrouped.dueToday.length})
                    </h2>
                    {todoGrouped.dueToday.map((item) => (
                      <TodoCard
                        key={item.id}
                        item={item}
                        isPending={pendingCareIds.has(item.id)}
                        onDone={() => handleCareDone(item)}
                        onSkip={() => handleCareSkip(item)}
                      />
                    ))}
                  </div>
                )}
                {todoGrouped.upcoming.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dim px-1">
                      Coming Up ({todoGrouped.upcoming.length})
                    </h2>
                    {todoGrouped.upcoming.map((item) => (
                      <TodoCard
                        key={item.id}
                        item={item}
                        isPending={pendingCareIds.has(item.id)}
                        onDone={() => handleCareDone(item)}
                        onSkip={() => handleCareSkip(item)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'my-plants' && (
          <div className="space-y-6">
            {/* Room management button */}
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingRoom(null); setRoomDialogOpen(true) }}
                className="flex items-center gap-1.5 text-xs text-plant hover:text-plant/80 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Room
              </button>
            </div>

            {plants.length === 0 && rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-plant-bg flex items-center justify-center mb-4">
                  <Leaf className="w-8 h-8 text-plant" />
                </div>
                <p className="text-text-muted text-sm font-medium mb-1">No plants yet</p>
                <p className="text-text-dim text-xs mb-4">
                  Add your first plant to start tracking care
                </p>
                <button
                  onClick={() => setAddPlantOpen(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-plant text-bg-primary hover:bg-plant/90 transition-colors cursor-pointer"
                >
                  Add Plant
                </button>
              </div>
            ) : (
              <>
                {/* Plants grouped by room */}
                {rooms.map((room) => {
                  const roomPlants = plantsByRoom.get(room.id) ?? []
                  return (
                    <RoomSection
                      key={room.id}
                      room={room}
                      plants={roomPlants}
                      onPlantClick={(p) => setSelectedPlantId(p.id)}
                      onEditRoom={() => { setEditingRoom(room); setRoomDialogOpen(true) }}
                    />
                  )
                })}

                {/* Unassigned plants */}
                {plantsByRoom.has(null) && (
                  <RoomSection
                    room={null}
                    plants={plantsByRoom.get(null)!}
                    onPlantClick={(p) => setSelectedPlantId(p.id)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5">
            {historyLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-plant-bg flex items-center justify-center mb-4">
                  <Undo2 className="w-8 h-8 text-plant" />
                </div>
                <p className="text-text-muted text-sm font-medium mb-1">No history yet</p>
                <p className="text-text-dim text-xs">
                  Care actions will appear here as you complete tasks
                </p>
              </div>
            ) : (
              historyGrouped.map((group) => (
                <div key={group.label} className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-text-dim px-1">
                    {group.label}
                  </h2>
                  {group.logs.map((log) => {
                    const config = CARE_TYPE_CONFIG[log.care_type]
                    const Icon = config.icon
                    const time = new Date(log.performed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    return (
                      <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-secondary border border-border-default">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', config.bgColor)}>
                          <Icon className={cn('w-4.5 h-4.5', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {log.plants.nickname}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                            {log.status === 'skipped' && (
                              <span className="text-xs text-text-dim">(skipped)</span>
                            )}
                            <span className="text-xs text-text-dim">{time}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => undoHistoryLog.mutate({ logId: log.id, plantId: log.plant_id, careType: log.care_type })}
                          disabled={undoHistoryLog.isPending}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-dim hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer shrink-0"
                          title="Undo"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Undo toast */}
      {undoInfo && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-5">
          <div className="flex items-center gap-3 bg-bg-elevated border border-border-default rounded-xl px-4 py-3 shadow-lg">
            <Check className="w-4 h-4 text-plant shrink-0" />
            <span className="text-sm text-text-secondary">{undoInfo.label}</span>
            <button
              onClick={() => undoCare.mutate(undoInfo)}
              disabled={undoCare.isPending}
              className="text-sm font-medium text-plant hover:text-plant/80 transition-colors cursor-pointer ml-1"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Add Plant dialog */}
      <AddPlantDialog
        open={addPlantOpen}
        onOpenChange={setAddPlantOpen}
        rooms={rooms}
        userId={userId}
        onSuccess={() => {}}
      />

      {/* Room dialog */}
      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        room={editingRoom}
        userId={userId}
        existingRooms={rooms}
      />

      {/* Plant detail bottom sheet */}
      {sheetMountedId && (
        <PlantDetailSheet
          plant={selectedPlant}
          visible={sheetVisible}
          onClose={closeSheet}
          rooms={rooms}
        />
      )}
    </div>
  )
}
