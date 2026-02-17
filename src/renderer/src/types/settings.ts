export type SettingsPayload = {
  llm_provider: string
  llm_api_key: string
  llm_base_url: string
  llm_model: string
  stt_provider: string
  stt_api_key: string
  stt_base_url: string
  stt_model: string
  tts_provider: string
  tts_api_key: string
  tts_base_url: string
  tts_model: string
  tts_voice: string
}

export type SettingsResponse = {
  success: boolean
  data: SettingsPayload
  message: string
}

export type SettingsUpdateRequest = Partial<
  Pick<SettingsPayload, 'llm_provider' | 'llm_base_url' | 'llm_model' | 'llm_api_key'>
>

export type TestConnectionRequest = {
  service_type: 'llm'
  provider: string
  api_key: string
  base_url: string
  model: string
}

export type TestConnectionResponse = {
  success: boolean
  data: {
    connected: boolean
    latency_ms: number
    model_info: string
    message: string
  }
  message: string
}
