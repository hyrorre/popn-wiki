export type Config = {
  title: string
  lang: string
  format_locale: string
  format_year: 'numeric' | '2-digit' | ''
  format_month: 'numeric' | '2-digit' | ''
  format_day: 'numeric' | '2-digit' | ''
  format_hour: 'numeric' | '2-digit' | ''
  format_minute: 'numeric' | '2-digit' | ''
  format_second: 'numeric' | '2-digit' | ''
  createdAt: string
  updatedAt: string
}

export type Profile = {
  id: string
  name: string | null
  avatar: string | null
  createdAt: string
  updatedAt: string
}

export type Page = {
  path: string
  revision: number
  body: string
  message: string | null
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  minor: number | null
}

export type Comment = {
  id: number
  path: string
  body: string
  userId: string
  replyTo: number | null
  replyToName: string | null
  createdAt: string
  updatedAt: string
  profiles: {
    id: string
    name: string | null
  } | null
  children?: Comment[]
}

export type Permission = {
  path: string
  role: string
  permission: string
  createdAt: string
  updatedAt: string
}
