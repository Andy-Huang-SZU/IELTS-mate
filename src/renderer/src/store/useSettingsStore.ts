import { create } from 'zustand'
import { fetchSettings, testLlmConnection, updateSettings } from '@renderer/services/settings'
import type { SettingsPayload, SettingsUpdateRequest } from '@renderer/types/settings'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

type SettingsStore = {
  settings: SettingsPayload | null
  newLlmKey: string
  newTopicgenKey: string
  newSttKey: string
  newTtsKey: string
  loading: boolean
  saveStatus: SaveStatus
  testStatus: SaveStatus
  testMessage: string
  error: string | null
  loadSettings: () => Promise<void>
  setField: <K extends keyof SettingsPayload>(field: K, value: SettingsPayload[K]) => void
  setNewLlmKey: (value: string) => void
  setNewTopicgenKey: (value: string) => void
  setNewSttKey: (value: string) => void
  setNewTtsKey: (value: string) => void
  saveSettings: () => Promise<void>
  runConnectionTest: (serviceType?: 'llm' | 'stt' | 'tts') => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  newLlmKey: '',
  newTopicgenKey: '',
  newSttKey: '',
  newTtsKey: '',
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

  setNewTopicgenKey: (value) => {
    set({ newTopicgenKey: value })
  },

  setNewSttKey: (value) => {
    set({ newSttKey: value })
  },

  setNewTtsKey: (value) => {
    set({ newTtsKey: value })
  },

  saveSettings: async () => {
    const current = get().settings
    if (!current) return

    set({ saveStatus: 'saving', error: null })
    try {
      const payload: SettingsUpdateRequest = {
        llm_provider: current.llm_provider,
        llm_base_url: current.llm_base_url,
        llm_model: current.llm_model,
        stt_provider: current.stt_provider,
        stt_base_url: current.stt_base_url,
        stt_model: current.stt_model,
        tts_provider: current.tts_provider,
        tts_base_url: current.tts_base_url,
        tts_model: current.tts_model,
        tts_voice: current.tts_voice,
        topicgen_use_same_llm: current.topicgen_use_same_llm,
        topicgen_provider: current.topicgen_provider,
        topicgen_base_url: current.topicgen_base_url,
        topicgen_model: current.topicgen_model,
        token_price_input: current.token_price_input,
        token_price_output: current.token_price_output,
        ...(get().newLlmKey.trim() ? { llm_api_key: get().newLlmKey.trim() } : {}),
        ...(get().newTopicgenKey.trim() ? { topicgen_api_key: get().newTopicgenKey.trim() } : {}),
        ...(get().newSttKey.trim() ? { stt_api_key: get().newSttKey.trim() } : {}),
        ...(get().newTtsKey.trim() ? { tts_api_key: get().newTtsKey.trim() } : {})
      }

      const response = await updateSettings(payload)
      set({
        settings: response.data,
        saveStatus: 'saved',
        newLlmKey: '',
        newTopicgenKey: '',
        newSttKey: '',
        newTtsKey: ''
      })
    } catch (error) {
      set({ saveStatus: 'failed', error: String(error) })
    }
  },

  runConnectionTest: async (serviceType = 'llm') => {
    const current = get().settings
    if (!current) return

    let rawKey = ''
    let provider = ''
    let baseUrl = ''
    let model = ''

    if (serviceType === 'llm') {
      rawKey = get().newLlmKey.trim()
      if (!rawKey) {
        set({ testStatus: 'failed', testMessage: 'Please enter an API Key in "Update LLM Key" first' })
        return
      }
      provider = current.llm_provider
      baseUrl = current.llm_base_url
      model = current.llm_model
    } else if (serviceType === 'stt') {
      rawKey = get().newSttKey.trim()
      if (!rawKey) {
        set({ testStatus: 'failed', testMessage: 'Please enter an API Key in "Update STT Key" first' })
        return
      }
      provider = current.stt_provider
      baseUrl = current.stt_base_url
      model = current.stt_model
    } else {
      rawKey = get().newTtsKey.trim()
      if (!rawKey) {
        set({ testStatus: 'failed', testMessage: 'Please enter an API Key in "Update TTS Key" first' })
        return
      }
      provider = current.tts_provider
      baseUrl = current.tts_base_url
      model = current.tts_model
    }

    set({ testStatus: 'saving', error: null, testMessage: '' })
    try {
      const response = await testLlmConnection({
        service_type: serviceType,
        provider,
        api_key: rawKey,
        base_url: baseUrl,
        model
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
