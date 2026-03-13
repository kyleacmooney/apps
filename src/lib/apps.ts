import { BookOpen, Dumbbell, Sprout, ListTodo, Sparkles, Compass, Film, type LucideIcon } from 'lucide-react'

export interface AppDefinition {
  slug: string
  name: string
  description: string
  path: string
  icon: LucideIcon
  /** Tailwind text color class for the icon */
  iconColor: string
  /** Tailwind border color class for hover */
  hoverBorderColor: string
}

export const ALL_APPS: AppDefinition[] = [
  {
    slug: 'exercises',
    name: 'Exercises',
    description: 'Form & progressions',
    path: '/exercises',
    icon: BookOpen,
    iconColor: 'text-upper-pull',
    hoverBorderColor: 'hover:border-upper-pull-border',
  },
  {
    slug: 'workouts',
    name: 'Workouts',
    description: 'Session history',
    path: '/workouts',
    icon: Dumbbell,
    iconColor: 'text-cardio',
    hoverBorderColor: 'hover:border-cardio-border',
  },
  {
    slug: 'plants',
    name: 'Plants',
    description: 'Care & tracking',
    path: '/plants',
    icon: Sprout,
    iconColor: 'text-plant',
    hoverBorderColor: 'hover:border-plant-border',
  },
  {
    slug: 'todos',
    name: 'Todos',
    description: 'Daily tasks',
    path: '/todos',
    icon: ListTodo,
    iconColor: 'text-ai',
    hoverBorderColor: 'hover:border-ai-border',
  },
  {
    slug: 'interests',
    name: 'Interests',
    description: 'Explore & learn',
    path: '/interests',
    icon: Compass,
    iconColor: 'text-core',
    hoverBorderColor: 'hover:border-core-border',
  },
  {
    slug: 'watchlist',
    name: 'Watchlist',
    description: 'Movies & shows',
    path: '/watchlist',
    icon: Film,
    iconColor: 'text-upper-push',
    hoverBorderColor: 'hover:border-upper-push-border',
  },
  {
    slug: 'chat',
    name: 'AI Chat',
    description: 'Ask anything',
    path: '/chat',
    icon: Sparkles,
    iconColor: 'text-ai',
    hoverBorderColor: 'hover:border-ai-border',
  },
]

export const ALL_APP_SLUGS = ALL_APPS.map((a) => a.slug)
