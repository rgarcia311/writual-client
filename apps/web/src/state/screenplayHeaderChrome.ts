import { create } from 'zustand'

export type ScreenplayHeaderChromeHandlers = {
  zoomOut: () => void
  zoomIn: () => void
  zoomReset: () => void
  print: () => void
}

interface ScreenplayHeaderChromeState {
  zoom: number
  /** True when the page is currently auto-fitted to the window (reset target). */
  isAutoZoomed: boolean
  collabActive: boolean
  handlers: ScreenplayHeaderChromeHandlers | null
  setChrome: (
    partial: Partial<
      Pick<ScreenplayHeaderChromeState, 'zoom' | 'isAutoZoomed' | 'collabActive' | 'handlers'>
    >,
  ) => void
}

export const useScreenplayHeaderChromeStore = create<ScreenplayHeaderChromeState>((set) => ({
  zoom: 1,
  isAutoZoomed: false,
  collabActive: false,
  handlers: null,
  setChrome: (partial) => set(partial),
}))
