import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getModuleFromPath, getModuleColors, type ModuleColorSet } from '../config/moduleColors'

export interface ModuleColorValue extends ModuleColorSet {
  moduleKey: string
}

const ModuleColorContext = createContext<ModuleColorValue | null>(null)

export function ModuleColorProvider({ children }: { children: ReactNode }) {
  const location = useLocation()

  const value = useMemo(() => {
    const moduleKey = getModuleFromPath(location.pathname)
    return {
      moduleKey,
      ...getModuleColors(moduleKey),
    }
  }, [location.pathname])

  return (
    <ModuleColorContext.Provider value={value}>
      {children}
    </ModuleColorContext.Provider>
  )
}

export function useModuleColor(): ModuleColorValue {
  const context = useContext(ModuleColorContext)
  if (!context) {
    const m = getModuleColors('dashboard')
    return { moduleKey: 'dashboard', ...m }
  }
  return context
}
