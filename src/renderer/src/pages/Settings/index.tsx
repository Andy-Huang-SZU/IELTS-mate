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
    newTopicgenKey,
    newSttKey,
    newTtsKey,
    loading,
    saveStatus,
    testStatus,
    testMessage,
    error,
    loadSettings,
    setField,
    setNewLlmKey,
    setNewTopicgenKey,
    setNewSttKey,
    setNewTtsKey,
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

      {/* Topic Generation LLM Settings */}
      <GlassCard className="mt-6 p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="mb-6">
          <h3 className="font-serif text-lg font-semibold text-[#2D3436] flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#74B9FF]/20">
              <svg className="h-4 w-4 text-[#0984E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            题目生成 LLM
          </h3>
          <p className="mt-1 text-sm text-[#636E72]">配置用于生成写作题目的 LLM（可复用评估 LLM 或独立配置）</p>
        </div>

        {/* Checkbox: use same LLM */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.topicgen_use_same_llm ?? true}
            onChange={(e) => setField('topicgen_use_same_llm', e.target.checked)}
            className="h-4 w-4 rounded border-[#636E72]/30 text-[#0984E3] focus:ring-[#0984E3]/30"
          />
          <span className="text-sm text-[#2D3436]">使用与评估 LLM 相同的配置</span>
        </label>

        {/* Topic gen model — always visible */}
        <label className={labelClass}>
          <span>题目生成 Model</span>
          <input
            className={inputClass}
            value={settings?.topicgen_model ?? ''}
            onChange={(e) => setField('topicgen_model', e.target.value)}
            placeholder="deepseek-chat"
          />
        </label>
        <p className="mt-1 text-xs text-[#B2BEC3]">
          {settings?.topicgen_use_same_llm
            ? '将使用评估 LLM 的 Provider / Base URL / API Key，仅 Model 可单独设置'
            : '使用下方独立的 Provider / Base URL / API Key 配置'}
        </p>

        {/* Independent config — only when not sharing */}
        {!settings?.topicgen_use_same_llm && (
          <>
            <label className={labelClass}>
              <span>Provider</span>
              <input
                className={inputClass}
                value={settings?.topicgen_provider ?? ''}
                onChange={(e) => setField('topicgen_provider', e.target.value)}
                placeholder="openai_compatible"
              />
            </label>
            <label className={labelClass}>
              <span>Base URL</span>
              <input
                className={inputClass}
                value={settings?.topicgen_base_url ?? ''}
                onChange={(e) => setField('topicgen_base_url', e.target.value)}
                placeholder="https://api.deepseek.com/v1"
              />
            </label>
            <label className={labelClass}>
              <span>当前 API Key（脱敏）</span>
              <input
                readOnly
                className={inputClass + ' text-[#636E72]'}
                value={settings?.topicgen_api_key ?? ''}
              />
            </label>
            <label className={labelClass}>
              <span>更新 API Key（可选）</span>
              <input
                type="password"
                className={inputClass}
                value={newTopicgenKey}
                onChange={(e) => setNewTopicgenKey(e.target.value)}
                placeholder="留空则不修改"
              />
            </label>
          </>
        )}
      </GlassCard>

      {/* Token Pricing */}
      <GlassCard className="mt-6 p-8 animate-fade-in" style={{ animationDelay: '0.12s' }}>
        <div className="mb-6">
          <h3 className="font-serif text-lg font-semibold text-[#2D3436] flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FDCB6E]/20">
              <svg className="h-4 w-4 text-[#E17055]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Token 价格
          </h3>
          <p className="mt-1 text-sm text-[#636E72]">用于 AI 生成题目时的费用预估（$/百万 tokens）</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <label className="block">
            <span className="block text-sm font-medium text-[#636E72] mb-1">Input Price</span>
            <div className="relative">
              <span className="absolute left-0 bottom-2.5 text-sm text-[#B2BEC3]">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass + ' pl-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'}
                value={settings?.token_price_input ?? 0}
                onChange={(e) => setField('token_price_input', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-[#B2BEC3]">$/M tokens（输入）</p>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-[#636E72] mb-1">Output Price</span>
            <div className="relative">
              <span className="absolute left-0 bottom-2.5 text-sm text-[#B2BEC3]">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass + ' pl-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'}
                value={settings?.token_price_output ?? 0}
                onChange={(e) => setField('token_price_output', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-[#B2BEC3]">$/M tokens（输出）</p>
          </label>
        </div>

        <p className="mt-4 text-xs text-[#B2BEC3]">
          设置后，在写作页面使用"AI 生成新题"时会显示预估费用。价格通常可在 LLM 提供商的定价页面查到。
        </p>
      </GlassCard>

      {/* Speech-to-Text Settings */}
      <GlassCard className="mt-6 p-8 animate-fade-in" style={{ animationDelay: '0.14s' }}>
        <div className="mb-6">
          <h3 className="font-serif text-lg font-semibold text-[#2D3436] flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#A78BFA]/20">
              <svg className="h-4 w-4 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </span>
            Speech-to-Text (STT)
          </h3>
          <p className="mt-1 text-sm text-[#636E72]">Configure voice recognition for the Speaking module (e.g. OpenAI Whisper)</p>
        </div>

        <label className={labelClass}>
          <span>STT Provider</span>
          <input
            className={inputClass}
            value={settings?.stt_provider ?? ''}
            onChange={(e) => setField('stt_provider', e.target.value)}
            placeholder="openai_whisper"
          />
        </label>
        <label className={labelClass}>
          <span>STT Base URL</span>
          <input
            className={inputClass}
            value={settings?.stt_base_url ?? ''}
            onChange={(e) => setField('stt_base_url', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className={labelClass}>
          <span>STT Model</span>
          <input
            className={inputClass}
            value={settings?.stt_model ?? ''}
            onChange={(e) => setField('stt_model', e.target.value)}
            placeholder="whisper-1"
          />
        </label>
        <label className={labelClass}>
          <span>Current STT Key (masked)</span>
          <input
            readOnly
            className={inputClass + ' text-[#636E72]'}
            value={settings?.stt_api_key ?? ''}
          />
        </label>
        <label className={labelClass}>
          <span>Update STT Key (optional)</span>
          <input
            type="password"
            className={inputClass}
            value={newSttKey}
            onChange={(e) => setNewSttKey(e.target.value)}
            placeholder="Leave empty to keep current key"
          />
        </label>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runConnectionTest('stt')}
            className="rounded-xl bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Test STT Connection
          </button>
          <p className="text-xs text-[#B2BEC3]">
            STT is used to transcribe your speech during Speaking practice sessions.
          </p>
        </div>
      </GlassCard>

      {/* Text-to-Speech Settings */}
      <GlassCard className="mt-6 p-8 animate-fade-in" style={{ animationDelay: '0.16s' }}>
        <div className="mb-6">
          <h3 className="font-serif text-lg font-semibold text-[#2D3436] flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#00CEC9]/20">
              <svg className="h-4 w-4 text-[#00B894]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </span>
            Text-to-Speech (TTS)
          </h3>
          <p className="mt-1 text-sm text-[#636E72]">Configure AI examiner voice output for the Speaking module</p>
        </div>

        <label className={labelClass}>
          <span>TTS Provider</span>
          <input
            className={inputClass}
            value={settings?.tts_provider ?? ''}
            onChange={(e) => setField('tts_provider', e.target.value)}
            placeholder="openai_tts"
          />
        </label>
        <label className={labelClass}>
          <span>TTS Base URL</span>
          <input
            className={inputClass}
            value={settings?.tts_base_url ?? ''}
            onChange={(e) => setField('tts_base_url', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className={labelClass}>
          <span>TTS Model</span>
          <input
            className={inputClass}
            value={settings?.tts_model ?? ''}
            onChange={(e) => setField('tts_model', e.target.value)}
            placeholder="tts-1"
          />
        </label>
        <label className={labelClass}>
          <span>Voice</span>
          <select
            className={inputClass + ' cursor-pointer appearance-none'}
            value={settings?.tts_voice ?? 'alloy'}
            onChange={(e) => setField('tts_voice', e.target.value)}
          >
            {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((v) => (
              <option key={v} value={v}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          <span>Current TTS Key (masked)</span>
          <input
            readOnly
            className={inputClass + ' text-[#636E72]'}
            value={settings?.tts_api_key ?? ''}
          />
        </label>
        <label className={labelClass}>
          <span>Update TTS Key (optional)</span>
          <input
            type="password"
            className={inputClass}
            value={newTtsKey}
            onChange={(e) => setNewTtsKey(e.target.value)}
            placeholder="Leave empty to keep current key"
          />
        </label>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runConnectionTest('tts')}
            className="rounded-xl bg-[#00B894] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Test TTS Connection
          </button>
          <p className="text-xs text-[#B2BEC3]">
            TTS generates the AI examiner's voice during Speaking practice.
          </p>
        </div>
      </GlassCard>

      {/* Vocabulary Learning Settings */}
      <GlassCard className="mt-6 p-8 animate-fade-in" style={{ animationDelay: '0.18s' }}>
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
