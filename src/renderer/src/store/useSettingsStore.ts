import { create } from 'zustand'
import { fetchSettings, testLlmConnection, updateSettings } from '@renderer/services/settings'
import type { SettingsPayload } from '@renderer/types/settings'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

type SettingsStore = {
  settings: SettingsPayload | null
  newLlmKey: string
  loading: boolean
  saveStatus: SaveStatus
  testStatus: SaveStatus
  testMessage: string
  error: string | null
  loadSettings: () => Promise<void>
  setField: <K extends keyof SettingsPayload>(field: K, value: SettingsPayload[K]) => void
  setNewLlmKey: (value: string) => void
  saveSettings: () => Promise<void>
  runConnectionTest: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  newLlmKey: '',
  loading: false,
  saveStatus: 'idle',
  testStatus: 'idle',
  testMessage: '',
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetchSettings()
      set({ settings: response.data, loading: false })
    } catch (error) {
      set({ loading: false, error: String(error) })
    }
  },

  setField: (field, value) => {
    const current = get().settings
    if (!current) return
    set({ settings: { ...current, [field]: value } })
  },

  setNewLlmKey: (value) => {
    set({ newLlmKey: value })
  },

  saveSettings: async () => {
    const current = get().settings
    if (!current) return

    set({ saveStatus: 'saving', error: null })
    try {
      const payload = {
        llm_provider: current.llm_provider,
        llm_base_url: current.llm_base_url,
        llm_model: current.llm_model,
        ...(get().newLlmKey.trim() ? { llm_api_key: get().newLlmKey.trim() } : {})
      }

      const response = await updateSettings(payload)
      set({
        settings: response.data,
        saveStatus: 'saved',
        newLlmKey: ''
      })
    } catch (error) {
      set({ saveStatus: 'failed', error: String(error) })
    }
  },

  runConnectionTest: async () => {
    const current = get().settings
    if (!current) return
    const rawKey = get().newLlmKey.trim()
    if (!rawKey) {
      set({
        testStatus: 'failed',
        testMessage: '请先在“更新 LLM Key”中输入待测试的 API Key'
      })
      return
    }
    set({ testStatus: 'saving', error: null, testMessage: '' })
    try {
      const response = await testLlmConnection({
        service_type: 'llm',
        provider: current.llm_provider,
        api_key: rawKey,
        base_url: current.llm_base_url,
        model: current.llm_model
      })

      set({
        testStatus: response.data.connected ? 'saved' : 'failed',
        testMessage: `${response.data.message} (${response.data.latency_ms}ms)`
      })
    } catch (error) {
      set({ testStatus: 'failed', error: String(error) })
    }
  }
}))
