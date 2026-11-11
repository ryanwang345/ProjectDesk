import { RadioNewsPlayer } from '@/components/radio-news-player'
import { STATION_680_NEWS } from '@/lib/radio-news'

export function RadioNewsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-12" data-testid="radio-news-page">
      <RadioNewsPlayer station={STATION_680_NEWS} />
    </div>
  )
}
