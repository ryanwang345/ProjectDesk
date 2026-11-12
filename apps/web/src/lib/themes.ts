export const THEME_KEY = 'projectdesk.theme'

export type ThemeId =
  | 'botanical'
  | 'luminescent'
  | 'alexandria'
  | 'bauhaus'
  | 'glacier'
  | 'carbon'
  | 'neon'
  | 'terra'
  | 'silk'

export type Theme = {
  id: ThemeId
  name: string
  colors: [string, string] | [string, string, string]
}

export const THEMES: Theme[] = [
  { id: 'botanical', name: 'Botanical Study', colors: ['#d7e36a', '#2f8f68'] },
  { id: 'luminescent', name: 'Luminescent Precision', colors: ['#5dffb0', '#3d7cff'] },
  { id: 'alexandria', name: 'Alexandria', colors: ['#3a5bd9', '#e2b34a', '#d4533a'] },
  { id: 'bauhaus', name: 'Bauhaus', colors: ['#e23b2f', '#2f5bd9', '#111111'] },
  { id: 'glacier', name: 'Glacier', colors: ['#b9d4f5', '#c5b6e8'] },
  { id: 'carbon', name: 'Carbon', colors: ['#3d6a8a', '#3d8f6a', '#1a1d22'] },
  { id: 'neon', name: 'Neon Tokyo', colors: ['#ff4fa3', '#ffe14a', '#3de0ff'] },
  { id: 'terra', name: 'Terra', colors: ['#6b7040', '#c4a574'] },
  { id: 'silk', name: 'Silk', colors: ['#7a6ad8', '#9eb6f0'] },
]

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value)
}

export function readTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (isThemeId(saved)) return saved
  } catch {
    /* private mode */
  }
  return 'botanical'
}
