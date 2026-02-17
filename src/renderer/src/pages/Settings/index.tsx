import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/useSettingsStore'

export const SettingsPage = (): JSX.Element => {
  const {
    settings,
    newLlmKey,
    loading,
    saveStatus,
    testStatus,
    testMessage,
    error,
    loadSettings,
    setField,
    setNewLlmKey,
    saveSettings,
    runConnectionTest
  } = useSettingsStore()

  useEffect(() => {
    if (!settings) {
      void loadSettings()
    }
  }, [settings, loadSettings])

  return (
    <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">
      <h2 className="text-base font-semibold">Settings / BYOK</h2>
      <div>
        <span className="text-slate-400">加载状态：</span> {loading ? 'loading' : 'ready'}
      </div>
      <div>
        <span className="text-slate-400">保存状态：</span> {saveStatus}
      </div>
      <div>
        <span className="text-slate-400">连接测试：</span> {testStatus}
        {testMessage ? <span className="ml-2 text-slate-300">{testMessage}</span> : null}
      </div>
      {error ? (
        <div className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-rose-200">{error}</div>
      ) : null}

      <label className="block">
        <span className="text-slate-300">LLM Provider</span>
        <input
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
          value={settings?.llm_provider ?? ''}
          onChange={(e) => setField('llm_provider', e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-slate-300">LLM Base URL</span>
        <input
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
          value={settings?.llm_base_url ?? ''}
          onChange={(e) => setField('llm_base_url', e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-slate-300">LLM Model</span>
        <input
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
          value={settings?.llm_model ?? ''}
          onChange={(e) => setField('llm_model', e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-slate-300">当前 LLM Key（脱敏）</span>
        <input
          readOnly
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-300"
          value={settings?.llm_api_key ?? ''}
        />
      </label>
      <label className="block">
        <span className="text-slate-300">更新 LLM Key（可选）</span>
        <input
          type="password"
          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
          value={newLlmKey}
          onChange={(e) => setNewLlmKey(e.target.value)}
          placeholder="留空则不修改 key"
        />
      </label>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="rounded border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
        >
          拉取设置
        </button>
        <button
          type="button"
          onClick={() => void runConnectionTest()}
          className="rounded border border-sky-700 px-3 py-1.5 text-sky-200 hover:bg-sky-900"
        >
          测试连接
        </button>
        <button
          type="button"
          onClick={() => void saveSettings()}
          className="rounded border border-emerald-700 px-3 py-1.5 text-emerald-200 hover:bg-emerald-900"
        >
          保存设置
        </button>
      </div>
    </section>
  )
}
