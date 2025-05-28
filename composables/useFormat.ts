export function useDateFormat(date: string | Date, config: Config) {
  if (typeof date === 'string') {
    date = new Date(date)
  }

  return date.toLocaleDateString(config.format_locale || undefined, {
    year: config.format_year || undefined,
    month: config.format_month || undefined,
    day: config.format_day || undefined
  })
}

export function useTimeFormat(date: string | Date, config: Config) {
  if (typeof date === 'string') {
    date = new Date(date)
  }

  return date.toLocaleTimeString(config.format_locale || undefined, {
    hour: config.format_hour || undefined,
    minute: config.format_minute || undefined,
    second: config.format_second || undefined
  })
}

export function useDateTimeFormat(date: string | Date, config: Config) {
  if (typeof date === 'string') {
    date = new Date(date)
  }

  return date.toLocaleString(config.format_locale || undefined, {
    year: config.format_year || undefined,
    month: config.format_month || undefined,
    day: config.format_day || undefined,
    hour: config.format_hour || undefined,
    minute: config.format_minute || undefined,
    second: config.format_second || undefined
  })
}
