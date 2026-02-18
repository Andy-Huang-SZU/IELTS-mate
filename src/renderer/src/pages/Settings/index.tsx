import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/useSettingsStore'
import { GlassCard, PageContainer } from '../../components/flux'

/**
 * 设置页 - Flux 风格
 * 文档：极其干净的表单；输入框 border-bottom / 极浅内凹；Test Connection 突出
 */
export function SettingsPage(): JSX.Element {
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

  const inputClass =
    'w-full border-0 border-b border-[#636E72]/30 bg-transparent py-2.5 text-[#2D3436] placeholder:text-[#636E72]/60 focus:border-[#E17055] focus:outline-none transition-colors'
  const labelClass = 'block text-sm font-medium text-[#636E72] mt-6 first:mt-0'

  return (
    <PageContainer narrow>
      <h1 className="sr-only">Settings</h1>
      <header className="mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Settings</h2>
        <p className="mt-1 text-sm text-[#636E72]">BYOK · 配置 API 与连接</p>
      </header>

      <GlassCard className="p-8 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        {loading && (
          <p className="text-sm text-[#636E72]">加载中…</p>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {saveStatus && (
          <p className="mb-4 text-sm text-[#636E72]">保存状态：{saveStatus}</p>
        )}

        <label className={labelClass}>
          <span>LLM Provider</span>
          <input
            className={inputClass}
            value={settings?.llm_provider ?? ''}
            onChange={(e) => setField('llm_provider', e.target.value)}
            placeholder="e.g. OpenAI / Azure"
          />
        </label>
        <label className={labelClass}>
          <span>LLM Base URL</span>
          <input
            className={inputClass}
            value={settings?.llm_base_url ?? ''}
            onChange={(e) => setField('llm_base_url', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className={labelClass}>
          <span>LLM Model</span>
          <input
            className={inputClass}
            value={settings?.llm_model ?? ''}
            onChange={(e) => setField('llm_model', e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </label>
        <label className={labelClass}>
          <span>当前 LLM Key（脱敏）</span>
          <input
            readOnly
            className={inputClass + ' text-[#636E72]'}
            value={settings?.llm_api_key ?? ''}
          />
        </label>
        <label className={labelClass}>
          <span>更新 LLM Key（可选）</span>
          <input
            type="password"
            className={inputClass}
            value={newLlmKey}
            onChange={(e) => setNewLlmKey(e.target.value)}
            placeholder="留空则不修改"
          />
        </label>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runConnectionTest()}
            className="rounded-xl bg-[#E17055] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
          >
            测试连接
          </button>
          {testStatus && (
            <span className="text-sm text-[#636E72]">
              {testStatus} {testMessage && `· ${testMessage}`}
            </span>
          )}
          <button
            type="button"
            onClick={() => void saveSettings()}
            className="rounded-xl border border-[#636E72]/40 bg-white/40 px-5 py-2.5 text-sm font-medium text-[#2D3436] backdrop-blur-sm transition-all hover:bg-white/60"
          >
            保存设置
          </button>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="rounded-xl border border-[#636E72]/40 bg-transparent px-5 py-2.5 text-sm text-[#636E72] transition-all hover:bg-white/40"
          >
            拉取设置
          </button>
        </div>
      </GlassCard>
    </PageContainer>
  )
}
