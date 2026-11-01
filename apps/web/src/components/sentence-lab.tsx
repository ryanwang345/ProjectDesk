import { useEffect, useRef, useState } from 'react'
import { BookOpen, CheckCircle2, LoaderCircle, SpellCheck } from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { evaluateEnglishSentence, fetchReferenceExamples, type ReferenceExample, type SentenceEvaluation } from '@/lib/api'

export function SentenceLab({ word, id }: { word: string; id: string }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  const [sentence, setSentence] = useState('')
  const [result, setResult] = useState<SentenceEvaluation | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [examples, setExamples] = useState<ReferenceExample[]>([])
  const [examplesLoading, setExamplesLoading] = useState(true)
  const [examplesError, setExamplesError] = useState(false)
  const [retry, setRetry] = useState(0)
  const activeCheck = useRef<AbortController | null>(null)

  useEffect(() => () => activeCheck.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    setExamples([])
    setExamplesLoading(true)
    setExamplesError(false)
    fetchReferenceExamples(word, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setExamples(data.examples) })
      .catch(() => { if (!controller.signal.aborted) setExamplesError(true) })
      .finally(() => { if (!controller.signal.aborted) setExamplesLoading(false) })
    return () => controller.abort()
  }, [word, retry])

  function edit(next: string) {
    activeCheck.current?.abort()
    setSentence(next)
    setResult(null)
    setError('')
    setChecking(false)
  }

  async function check() {
    if (!sentence.trim() || checking) return
    // LanguageTool offsets use UTF-16, the same indexing as JS strings.
    const text = sentence.trim()
    const controller = new AbortController()
    activeCheck.current?.abort()
    activeCheck.current = controller
    setSentence(text)
    setChecking(true)
    setResult(null)
    setError('')
    try {
      const checked = await evaluateEnglishSentence({ word, sentence: text }, controller.signal)
      if (!controller.signal.aborted) setResult(checked)
    } catch {
      if (!controller.signal.aborted) setError(zh
        ? '语法检查服务暂时不可用，请稍后重试。'
        : 'The grammar checker is unavailable. Please try again later.')
    } finally {
      if (!controller.signal.aborted) setChecking(false)
    }
  }

  return (
    <section id={id} className="scroll-mt-20 rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          {zh ? '造句练习 (Diagnostic Lab)' : 'Sentence Practice (Diagnostic Lab)'}
        </h3>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
          {zh ? '规则检查 · 无 AI' : 'Rule-based · No AI'}
        </span>
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
          <label htmlFor={`${id}-sentence`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <SpellCheck className="size-4" aria-hidden="true" />
            {zh ? '自己造句 · 语法与拼写检查' : 'Your Sentence · Grammar & Spelling'}
          </label>
          <textarea
            id={`${id}-sentence`}
            value={sentence}
            onChange={(event) => edit(event.target.value)}
            onKeyDown={(event) => {
              if (!event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                void check()
              }
            }}
            rows={4}
            maxLength={600}
            placeholder={zh
              ? `用 “${word}” 写一个句子（Ctrl/Cmd + Enter 检查）…`
              : `Write a sentence using “${word}” (Ctrl/Cmd + Enter to check)…`}
            aria-describedby={`${id}-hint`}
            className="w-full resize-y rounded-xl border border-border/80 bg-background/85 px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span id={`${id}-hint`} className="text-[11px] text-muted-foreground">
              {zh ? '美式英语 · 语法、拼写与标点' : 'US English · Grammar, spelling & punctuation'}
            </span>
            <div className="flex items-center gap-2">
              {sentence && <Button type="button" size="sm" variant="ghost" onClick={() => edit('')}>{zh ? '清空' : 'Clear'}</Button>}
              <Button type="button" size="sm" disabled={checking || !sentence.trim()} onClick={() => void check()}>
                {checking && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
                {checking ? (zh ? '检查中…' : 'Checking…') : (zh ? '检查语法与拼写' : 'Check sentence')}
              </Button>
            </div>
          </div>

          <div aria-live="polite" aria-busy={checking} className="space-y-2 text-xs">
            {error && <p role="alert" className="text-destructive">{error}</p>}
            {result && <>
              {!result.usedWord && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-foreground">
                {zh ? `未找到目标词 “${word}”。请使用该词后再检查。` : `The target word “${word}” was not found. Use it and check again.`}
              </p>}
              <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
                {result.matches.length === 0 && <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />}
                {result.matches.length === 0
                  ? (zh ? '未检测到规则覆盖范围内的问题。' : 'No issues detected by the available rules.')
                  : (zh ? `发现 ${result.matches.length} 条建议` : `${result.matches.length} suggestion${result.matches.length === 1 ? '' : 's'} found`)}
              </p>
              {result.matches.map((match, index) => (
                <div key={`${match.rule.id}-${index}`} className="space-y-2 rounded-xl border border-border bg-background/80 p-3">
                  {match.length > 0 && <p className="break-words font-mono text-sm text-foreground">“{sentence.slice(match.offset, match.offset + match.length)}”</p>}
                  <p className="leading-relaxed text-muted-foreground">{match.message}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {match.replacements.slice(0, 5).map(({ value }, suggestionIndex) => (
                      <button key={suggestionIndex} type="button" className="max-w-full break-words rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20"
                        onClick={() => edit(sentence.slice(0, match.offset) + value + sentence.slice(match.offset + match.length))}>
                        {zh ? '替换为：' : 'Use: '}{value || (zh ? '删除' : 'Remove')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {result && result.matches.length > 0 && <p className="text-muted-foreground">{zh ? '应用建议后，请重新检查句子。' : 'After applying a suggestion, check your sentence again.'}</p>}
            </>}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {zh ? '规则检查可能遗漏语境或用词问题，不提供雅思评分。建议说明使用英语。' : 'Rules may miss context or word-choice issues. No IELTS score is assigned.'}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/[0.06] p-4" aria-busy={examplesLoading}>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <BookOpen className="size-4" aria-hidden="true" />
            {zh ? '参考例句' : 'Reference Examples'}
          </p>
          <div className="space-y-2" aria-live="polite">
            {examplesLoading && <p className="text-xs text-muted-foreground">{zh ? '正在查找已校对例句…' : 'Loading proofread examples…'}</p>}
            {examplesError && <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">{zh ? '例句暂时无法加载。' : 'Examples could not be loaded.'}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setRetry((count) => count + 1)}>{zh ? '重试' : 'Retry'}</Button>
            </div>}
            {!examplesLoading && !examplesError && examples.length === 0 && <p className="text-xs text-muted-foreground">
              {zh ? '暂未找到包含该词的已校对例句。' : 'No proofread examples containing this word were found.'}
            </p>}
            {examples.map((example) => <div key={example.id} className="space-y-2 rounded-xl border border-primary/25 bg-background/75 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 font-mono text-xs leading-relaxed text-foreground">“{example.text}”</p>
                <Pronunciation word={example.text} showText={false} allowAI={false} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                <a href={example.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Tatoeba · {example.author}</a>
                {' · '}<a href={example.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{example.license}</a>
              </p>
            </div>)}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {zh ? '来自 Tatoeba 的已校对英语例句，展示真实用法。' : 'From Tatoeba’s proofread English collection, showing existing usage.'}
          </p>
        </div>
      </div>
    </section>
  )
}
