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
  // Topic generation LLM config
  topicgen_use_same_llm: boolean
  topicgen_provider: string
  topicgen_api_key: string
  topicgen_base_url: string
  topicgen_model: string
  // Token pricing — $/million tokens for cost estimation
  token_price_input: number
  token_price_output: number
}

export type SettingsResponse = {
  success: boolean
  data: SettingsPayload
  message: string
}

export type SettingsUpdateRequest = Partial<
  Pick<
    SettingsPayload,
    | 'llm_provider' | 'llm_base_url' | 'llm_model' | 'llm_api_key'
    | 'stt_provider' | 'stt_api_key' | 'stt_base_url' | 'stt_model'
    | 'tts_provider' | 'tts_api_key' | 'tts_base_url' | 'tts_model' | 'tts_voice'
    | 'topicgen_use_same_llm' | 'topicgen_provider' | 'topicgen_api_key'
    | 'topicgen_base_url' | 'topicgen_model'
    | 'token_price_input' | 'token_price_output'
  >
>

export type TestConnectionRequest = {
  service_type: 'llm' | 'stt' | 'tts'
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
