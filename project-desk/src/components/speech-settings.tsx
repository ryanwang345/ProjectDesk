import { useEffect, useState, useSyncExternalStore } from 'react'
import { AudioLines } from 'lucide-react'
import { Pronunciation } from '@/components/pronunciation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { getSpeechPreferences, setSpeechPreferences, subscribeSpeech, type SpeechAccent } from '@/lib/speech'

export function SpeechSettings() {
  const { locale } = useI18n()
  const isZh = locale === 'zh'
  const preferences = useSyncExternalStore(subscribeSpeech, getSpeechPreferences)
  const [open, setOpen] = useState(false)
  const [neuralAvailable, setNeuralAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void fetch('/api/english/speech', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ available: boolean }> : { available: false })
      .then((status) => setNeuralAvailable(status.available))
      .catch(() => { if (!controller.signal.aborted) setNeuralAvailable(false) })
    return () => controller.abort()
  }, [open])
  const accents: Array<{ id: SpeechAccent; label: string }> = [
    { id: 'auto', label: isZh ? '自动选择' : 'Automatic' },
    { id: 'en-GB', label: isZh ? '英式 UK' : 'British · UK' },
    { id: 'en-US', label: isZh ? '美式 US' : 'American · US' },
  ]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={isZh ? '发音设置' : 'Pronunciation settings'} title={isZh ? '发音设置' : 'Pronunciation settings'}>
          <AudioLines className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-testid="speech-settings">
        <DialogHeader>
          <DialogTitle>{isZh ? '更自然的英语发音' : 'Natural English pronunciation'}</DialogTitle>
          <DialogDescription>{isZh ? '优先使用单词真人录音。句子使用自然的 AI 语音（如可用），或设备提供的最佳英语语音。' : 'Hear recorded pronunciations for words. Sentences use natural AI speech when available, or the best English voice on your device.'}</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{isZh ? '口音' : 'Accent'}</legend>
          <div className="flex flex-wrap gap-2">
            {accents.map((accent) => (
              <Button key={accent.id} variant={preferences.accent === accent.id ? 'default' : 'outline'} size="sm" aria-pressed={preferences.accent === accent.id} onClick={() => setSpeechPreferences({ accent: accent.id })}>{accent.label}</Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{isZh ? '自动模式优先选择真人录音，不限制英式或美式口音。' : 'Automatic prioritizes an available recording in either accent.'}</p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{isZh ? '速度' : 'Speed'}</legend>
          <div className="flex gap-2">
            <Button variant={preferences.speed === 'normal' ? 'default' : 'outline'} size="sm" aria-pressed={preferences.speed === 'normal'} onClick={() => setSpeechPreferences({ speed: 'normal' })}>{isZh ? '自然语速 · 1×' : 'Natural · 1×'}</Button>
            <Button variant={preferences.speed === 'slow' ? 'default' : 'outline'} size="sm" aria-pressed={preferences.speed === 'slow'} onClick={() => setSpeechPreferences({ speed: 'slow' })}>{isZh ? '慢速练习 · 0.8×' : 'Slow practice · 0.8×'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{isZh ? '慢速播放保留原来的音高。' : 'Slower playback preserves the original pitch.'}</p>
        </fieldset>
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground">{isZh ? '试听' : 'Voice preview'}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed">The weather looks lovely. Shall we go for a walk?</p>
            <Pronunciation word="The weather looks lovely. Shall we go for a walk?" showText={false} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="speech-provider-status">
          {neuralAvailable === null ? (isZh ? '正在检查句子语音…' : 'Checking sentence voice…') : neuralAvailable
            ? (isZh ? '句子语音：自然 AI 语音（非真人录音）。' : 'Sentence voice: natural AI speech, not a human recording.')
            : (isZh ? '句子语音：设备英语语音。可在服务器配置 AI 句子语音。单词录音仍可使用。' : 'Sentence voice: device English voice. AI sentence speech can be enabled on the server. Word recordings remain available.')}
        </p>
        <p className="text-[11px] text-muted-foreground">{isZh ? '单词录音来自 ' : 'Word recordings via '}<a className="underline underline-offset-2" href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">Free Dictionary API</a>{isZh ? '；播放后可查看来源和许可。' : '; source and license appear beside the played word.'}</p>
      </DialogContent>
    </Dialog>
  )
}
