export const formatDate = (dateStr: string) => {
  const { format } = useAppConfig()
  return new Date(dateStr).toLocaleDateString(format.locale, format.dateTimeFormatOptions)
}
