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
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type Page = {
  path: string
  revision: number
  body: string
  created_by: Profile | string
  updated_by: Profile | string
  created_at: string
  updated_at: string
}

export type Comment = {
  id: string
  path: string
  body: string
  created_by: Profile | string
  reply_to: string
  created_at: string
  updated_at: string
}

export type Permission = {
  path: string
  role: string
  permission: string
  created_at: string
  updated_at: string
}
