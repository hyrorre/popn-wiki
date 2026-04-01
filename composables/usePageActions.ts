export const usePageActions = () => {
  const editMode = useState<boolean>('page-edit-mode', () => false)
  const isSidebarOpen = useState<boolean>('page-sidebar-open', () => false)
  const revision = useState<number | null>('page-revision', () => null)
  const canEdit = useState<boolean>('page-can-edit', () => false)

  const toggleEditMode = () => {
    editMode.value = !editMode.value
  }

  const setEditMode = (value: boolean) => {
    editMode.value = value
  }

  const setSidebarOpen = (value: boolean) => {
    isSidebarOpen.value = value
  }

  const setRevision = (value: number | null) => {
    revision.value = value
  }

  const setCanEdit = (value: boolean) => {
    canEdit.value = value
  }

  return {
    editMode,
    isSidebarOpen,
    revision,
    canEdit,
    toggleEditMode,
    setEditMode,
    setSidebarOpen,
    setRevision,
    setCanEdit
  }
}
