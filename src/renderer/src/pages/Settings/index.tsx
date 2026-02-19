import { useEffect, useState } from 'react'
import { useSettingsStore } from '@renderer/store/useSettingsStore'
import { useVocabularyStore } from '@renderer/store/useVocabularyStore'
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

  const { vocabSettings, loadVocabSettings, updateVocabSettings } = useVocabularyStore()
  const [localDailyLimit, setLocalDailyLimit] = useState<number>(30)
  const [vocabSaveStatus, setVocabSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    if (!settings) {
      void loadSettings()
    }
    void loadVocabSettings()
  }, [settings, loadSettings, loadVocabSettings])

  useEffect(() => {
    if (vocabSettings) {
      setLocalDailyLimit(vocabSettings.daily_new_words_limit)
    }
  }, [vocabSettings])

  const adjustLimit = (delta: number): void => {
    setLocalDailyLimit((prev) => Math.max(5, Math.min(100, prev + delta)))
  }

  const handleVocabSave = async (): Promise<void> => {
    setVocabSaveStatus('saving')
    await updateVocabSettings({ daily_new_words_limit: localDailyLimit })
    setVocabSaveStatus('saved')
    setTimeout(() => setVocabSaveStatus('idle'), 2000)
  }

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

      {/* LLM Settings */}
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

      {/* Vocabulary Learning Settings */}
      <GlassCard className="mt-6 p-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="mb-6">
          <h3 className="font-serif text-lg font-semibold text-[#2D3436] flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#5EEAD4]/20">
              <svg className="h-4 w-4 text-[#00B894]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </span>
            词汇学习设置
          </h3>
          <p className="mt-1 text-sm text-[#636E72]">自定义每日学习节奏</p>
        </div>

        <div className="space-y-6">
          {/* Daily new words limit */}
          <div>
            <label className="block text-sm font-medium text-[#636E72] mb-3">
              每日新词数量
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-xl border border-[#636E72]/20 bg-white/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => adjustLimit(-5)}
                  disabled={localDailyLimit <= 5}
                  className="px-4 py-2.5 text-lg font-medium text-[#636E72] transition-all hover:bg-[#E17055]/10 hover:text-[#E17055] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={localDailyLimit}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v)) setLocalDailyLimit(Math.max(5, Math.min(100, v)))
                  }}
                  className="w-16 border-x border-[#636E72]/20 bg-transparent py-2.5 text-center text-lg font-semibold text-[#2D3436] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => adjustLimit(5)}
                  disabled={localDailyLimit >= 100}
                  className="px-4 py-2.5 text-lg font-medium text-[#636E72] transition-all hover:bg-[#5EEAD4]/10 hover:text-[#00B894] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-[#636E72]">词 / 天</span>
            </div>
            <p className="mt-2 text-xs text-[#B2BEC3]">范围 5 ~ 100，以 5 为步进调整，也可直接输入数值</p>
          </div>

          {/* Preset quick selections */}
          <div>
            <label className="block text-sm font-medium text-[#636E72] mb-3">
              快捷预设
            </label>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 50, 80].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLocalDailyLimit(n)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-[1.03] active:scale-[0.97] ${
                    localDailyLimit === n
                      ? 'bg-[#E17055] text-white shadow-md'
                      : 'border border-[#636E72]/20 bg-white/40 text-[#636E72] hover:bg-white/60'
                  }`}
                >
                  {n} 词
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleVocabSave()}
            disabled={vocabSaveStatus === 'saving'}
            className="rounded-xl bg-[#00B894] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {vocabSaveStatus === 'saving' ? '保存中…' : '保存词汇设置'}
          </button>
          {vocabSaveStatus === 'saved' && (
            <span className="text-sm text-[#00B894] animate-fade-in flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已保存
            </span>
          )}
          {vocabSettings && localDailyLimit !== vocabSettings.daily_new_words_limit && (
            <span className="text-xs text-[#FDCB6E]">有未保存的更改</span>
          )}
        </div>
      </GlassCard>
    </PageContainer>
  )
}
