import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { useI18n } from '@/i18n'
import { FEATURES, featureForLocation, useFeatures } from '@/lib/features'
import { Button } from '@/components/ui/button'

export function FeatureGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { enabled } = useFeatures()
  const { t, locale } = useI18n()
  const featureId = featureForLocation(location.pathname, location.search)
  if (!featureId || enabled[featureId]) return children
  const feature = FEATURES.find(({ id }) => id === featureId)!
  const zh = locale === 'zh'
  return <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-8 text-center" data-testid="feature-disabled">
    <LockKeyhole className="mx-auto mb-4 size-8 text-muted-foreground" aria-hidden="true" />
    <h1 className="font-display text-2xl font-semibold">{zh ? '此页面已停用' : 'This page is disabled'}</h1>
    <p className="mt-3 text-sm text-muted-foreground">{zh ? `“${t(feature.label)}”已在此浏览器中关闭。请前往设置重新启用。` : `“${t(feature.label)}” is turned off in this browser. Enable it in Settings to open this page.`}</p>
    <Button asChild className="mt-6"><Link to="/settings">{zh ? '打开设置' : 'Open Settings'}</Link></Button>
  </div>
}
