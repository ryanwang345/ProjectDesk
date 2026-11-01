import { SlidersHorizontal } from 'lucide-react'
import { useI18n } from '@/i18n'
import { FEATURES, useFeatures } from '@/lib/features'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const { t, locale } = useI18n()
  const { enabled, setEnabled, saveError } = useFeatures()
  const zh = locale === 'zh'
  return <div className="mx-auto w-full max-w-3xl space-y-6">
    <div className="space-y-2">
      <h1 className="flex items-center gap-3 font-display text-3xl font-semibold"><SlidersHorizontal className="size-6 text-primary" aria-hidden="true" />{zh ? '设置' : 'Settings'}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{zh ? '选择要使用的页面。关闭后，页面会从导航栏隐藏，也无法通过网址打开。' : 'Choose which pages to use. Turning a page off hides it from navigation and blocks direct URL access.'}</p>
      <p className="text-xs text-muted-foreground">{zh ? '更改自动保存在此浏览器中。设置页面始终可用。' : 'Changes save automatically in this browser. Settings always stays available.'}</p>
    </div>
    {saveError && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{zh ? '无法保存设置。请允许浏览器存储后重试。' : 'Could not save your settings. Allow browser storage and try again.'}</p>}
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <h2 className="border-b border-border px-5 py-4 text-sm font-semibold">{zh ? '页面与导航' : 'Pages & navigation'}</h2>
      <div className="divide-y divide-border">
        {FEATURES.map((feature) => <div key={feature.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <label id={`feature-${feature.id}-label`} htmlFor={`feature-${feature.id}`} className="cursor-pointer text-sm font-medium">{t(feature.label)}</label>
            <p className="mt-1 text-xs text-muted-foreground">{enabled[feature.id] ? (zh ? '显示在导航栏中，可访问' : 'Visible in navigation and accessible') : (zh ? '已隐藏，无法访问' : 'Hidden and inaccessible')}</p>
          </div>
          <button id={`feature-${feature.id}`} type="button" role="switch" aria-checked={enabled[feature.id]} aria-labelledby={`feature-${feature.id}-label`}
            onClick={() => setEnabled(feature.id, !enabled[feature.id])}
            className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <span aria-hidden="true" className="text-xs text-muted-foreground">{enabled[feature.id] ? (zh ? '开' : 'On') : (zh ? '关' : 'Off')}</span>
            <span aria-hidden="true" className={cn('inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors', enabled[feature.id] ? 'bg-primary' : 'bg-muted-foreground/40')}>
              <span className={cn('size-5 rounded-full bg-white shadow-sm transition-transform', enabled[feature.id] ? 'translate-x-5' : 'translate-x-0')} />
            </span>
          </button>
        </div>)}
      </div>
    </section>
  </div>
}
