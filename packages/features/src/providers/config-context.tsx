'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface FeaturesConfig {
  /** Base URL for API calls. Empty string = relative (Next.js web). Full URL for Tauri. */
  apiBaseUrl: string
  /** Google API key for Drive Picker (restricts to your project) */
  googleApiKey: string
  /** Logo URL. Web uses '/logo.png', desktop uses a bundled asset import. */
  logoSrc?: string
}

const ConfigContext = createContext<FeaturesConfig>({
  apiBaseUrl: '',
  googleApiKey: '',
})

export function ConfigProvider({ config, children }: { config: FeaturesConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

export function useConfig(): FeaturesConfig {
  return useContext(ConfigContext)
}
