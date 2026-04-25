import { create } from 'zustand'

export type ScreenplayHeaderChromeHandlers = {
  zoomOut: () => void
  zoomIn: () => void
  zoomReset: () => void
  print: () => void
}

interface ScreenplayHeaderChromeState {
  zoom: number
  collabActive: boolean
  handlers: ScreenplayHeaderChromeHandlers | null
  setChrome: (partial: Partial<Pick<ScreenplayHeaderChromeState, 'zoom' | 'collabActive' | 'handlers'>>) => void
}

export const useScreenplayHeaderChromeStore = create<ScreenplayHeaderChromeState>((set) => ({
  zoom: 1,
  collabActive: false,
  handlers: null,
  setChrome: (partial) => set(partial),
}))
