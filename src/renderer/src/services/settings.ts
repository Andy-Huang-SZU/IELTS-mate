import type {
  SettingsResponse,
  SettingsUpdateRequest,
  TestConnectionRequest,
  TestConnectionResponse
} from '@renderer/types/settings'

const getBaseUrl = async (): Promise<string> => {
  const info = await window.electronAPI.getBackendInfo()
  if (!info.baseUrl) {
    throw new Error('Backend is not ready')
  }
  return info.baseUrl
}

export const fetchSettings = async (): Promise<SettingsResponse> => {
  const baseUrl = await getBaseUrl()
  const response = await fetch(`${baseUrl}/api/settings`)
  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.status}`)
  }
  return (await response.json()) as SettingsResponse
}

export const updateSettings = async (payload: SettingsUpdateRequest): Promise<SettingsResponse> => {
  const baseUrl = await getBaseUrl()
  const response = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    throw new Error(`Failed to update settings: ${response.status}`)
  }
  return (await response.json()) as SettingsResponse
}

export const testLlmConnection = async (
  payload: TestConnectionRequest
): Promise<TestConnectionResponse> => {
  const baseUrl = await getBaseUrl()
  const response = await fetch(`${baseUrl}/api/settings/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    throw new Error(`Failed to test connection: ${response.status}`)
  }
  return (await response.json()) as TestConnectionResponse
}
