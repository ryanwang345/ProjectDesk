export type RadioVocabularyItem = {
  word: string
  pos: string
  ipa: string
  meaning: string
  band: string
  contextSnippet: string
}

export type RadioLiaison = {
  phrase: string
  ipa: string
  noteZh: string
  note: string
}

export type RadioLiveArticle = {
  title: string
  titleZh: string
  summary: string
  summaryZh?: string
  link: string
  source: string
  category: string
  publishedAt: string
}

export type RadioLiveWeather = {
  temperatureC: number
  feelsLikeC: number
  windSpeedKmh: number
  windGustsKmh: number
  windDirection: string
  condition: string
  conditionZh: string
  observedAt: string
}

export type RadioNewsWheelSegment = {
  id: string
  timeMark: string // e.g. "Traffic on the 1s", "Top of the Hour :00", "Business at :26"
  title: string
  titleZh: string
  anchor: string
  startSecond: number
  endSecond: number
  text: string
  textZh: string
  publishedAt?: string
  sourceUrl?: string
  sourceName?: string
  liaisons: RadioLiaison[]
  keyLexis: RadioVocabularyItem[]
  relatedArticles?: RadioLiveArticle[]
}

export type RadioBulletin = {
  updatedAt: string
  source: string
  isLive: boolean
  weather?: RadioLiveWeather
  segments: RadioNewsWheelSegment[]
  liveArticles: RadioLiveArticle[]
}

export async function fetchLiveRadioBulletin(forceRefresh = false): Promise<RadioBulletin | null> {
  try {
    const endpoint = forceRefresh ? '/api/radio/news/refresh' : '/api/radio/news'
    const resp = await fetch(endpoint, {
      method: forceRefresh ? 'POST' : 'GET',
      headers: { Accept: 'application/json' },
    })
    if (resp.ok) {
      const data = (await resp.json()) as RadioBulletin
      if (data && Array.isArray(data.segments) && data.segments.length > 0 && data.isLive) {
        const existing = Array.isArray(data.liveArticles) ? data.liveArticles : []
        const cityNewsCount = existing.filter(
          (a) => a.source.toLowerCase().includes('citynews') || a.link.toLowerCase().includes('citynews.ca'),
        ).length
        if (cityNewsCount < 5) {
          const browserCityNews = await fetchFeedArticlesInBrowser({
            url: 'https://toronto.citynews.ca/feed/',
            source: 'CityNews 680 Toronto',
            slot: 'Top Headlines',
          })
          if (browserCityNews.length > 0) {
            await translateArticlesBatch(browserCityNews)
            const seen = new Set<string>()
            const merged: RadioLiveArticle[] = []
            for (const art of [...browserCityNews, ...existing]) {
              const key = art.title.toLowerCase().trim()
              if (key && !seen.has(key)) {
                seen.add(key)
                merged.push(art)
              }
            }
            data.liveArticles = merged
          }
        }
        return data
      }
    }
  } catch {
    // Fall through to direct browser live fetch
  }
  return fetchBrowserLiveBulletin()
}

function describeWmoCode(code: number): { en: string; zh: string } {
  if (code === 0) return { en: 'Clear skies', zh: '晴朗无云' }
  if (code === 1) return { en: 'Mainly clear', zh: '晴间少云' }
  if (code === 2) return { en: 'Partly cloudy', zh: '多云间晴' }
  if (code === 3) return { en: 'Overcast', zh: '阴天多云' }
  if (code === 45 || code === 48) return { en: 'Foggy conditions', zh: '有雾' }
  if (code >= 51 && code <= 57) return { en: 'Light drizzle', zh: '零星毛毛雨' }
  if (code >= 61 && code <= 67) return { en: 'Rain showers', zh: '降雨天气' }
  if (code >= 71 && code <= 77) return { en: 'Snowfall', zh: '降雪天气' }
  if (code >= 80 && code <= 82) return { en: 'Scattered showers', zh: '阵雨天气' }
  if (code >= 85 && code <= 86) return { en: 'Snow showers', zh: '阵雪天气' }
  if (code >= 95) return { en: 'Thunderstorms', zh: '雷暴天气' }
  return { en: 'Variable cloudiness', zh: '多云天气' }
}

function degToCardinal(deg: number): string {
  const dirs = ['northerly', 'northeasterly', 'easterly', 'southeasterly', 'southerly', 'southwesterly', 'westerly', 'northwesterly']
  return dirs[Math.max(0, Math.floor((deg + 22.5) / 45) % 8)]
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&rsquo;/gi, '’')
    .replace(/&#8216;|&lsquo;/gi, '‘')
    .replace(/&#8220;|&ldquo;/gi, '“')
    .replace(/&#8221;|&rdquo;/gi, '”')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8230;|&hellip;/gi, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

async function translateEnToZh(text: string): Promise<string> {
  if (!text.trim()) return ''
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) return ''
    const json = (await res.json()) as unknown[]
    const sentences = Array.isArray(json?.[0]) ? (json[0] as unknown[]) : []
    return sentences
      .map((s) => (Array.isArray(s) && typeof s[0] === 'string' ? s[0] : ''))
      .join('')
      .trim()
  } catch {
    return ''
  }
}

function classifyClientArticle(title: string, summary: string, fallbackSlot: string): string {
  const s = `${title} ${summary}`.toLowerCase()
  if (/(traffic|weather|highway|401|gardiner|dvp|don valley|ttc|subway|go transit|metrolinx|commute|lane|closure|collision|crash|snow|rain|storm|wind|temperature|forecast|pearson)/.test(s)) {
    return 'Traffic & Weather'
  }
  if (/(tsx|bank of canada|interest rate|inflation|economy|economic|market|stock|dollar|tariff|trade|business|housing|mortgage|retail|jobs|gdp)/.test(s)) {
    return 'Business News'
  }
  if (/(maple leafs|blue jays|raptors|argonauts|tfc|nhl|nba|mlb|hockey|baseball|basketball|soccer|playoff|concert|festival|tiff|culture|weekend|harbourfront)/.test(s)) {
    return 'Sports & Culture'
  }
  return fallbackSlot
}

function parseRssXmlItems(xmlText: string, source: string, fallbackSlot: string): RadioLiveArticle[] {
  if (typeof DOMParser === 'undefined' || !xmlText.includes('<item')) return []
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
    const itemNodes = Array.from(doc.querySelectorAll('item'))
    const out: RadioLiveArticle[] = []
    for (const node of itemNodes) {
      const rawTitle = node.querySelector('title')?.textContent ?? ''
      const title = stripHtml(rawTitle)
      if (!title) continue
      const link = (node.querySelector('link')?.textContent ?? '').trim()
      const pubDate = (node.querySelector('pubDate')?.textContent ?? '').trim()
      const rawDesc = node.querySelector('description')?.textContent ?? ''
      const encodedNode =
        node.getElementsByTagNameNS('*', 'encoded')[0] ?? node.getElementsByTagName('content:encoded')[0]
      const rawEncoded = encodedNode?.textContent ?? ''
      let summary = stripHtml(rawDesc)
        .replace(/The post .*? appeared first on CityNews.*$/i, '')
        .trim()
      if (rawEncoded) {
        const full = stripHtml(rawEncoded)
          .replace(/The post .*? appeared first on CityNews.*$/i, '')
          .trim()
        if (full.length > summary.length) {
          summary = full
        }
      }
      if (summary.length > 900) {
        summary = `${summary.slice(0, 900).trim()}...`
      }
      out.push({
        title,
        titleZh: '',
        summary,
        link,
        source,
        category: classifyClientArticle(title, summary, fallbackSlot),
        publishedAt: pubDate || new Date().toISOString(),
      })
    }
    return out
  } catch {
    return []
  }
}

async function fetchFeedArticlesInBrowser(f: {
  url: string
  source: string
  slot: string
}): Promise<RadioLiveArticle[]> {
  // 1. Try raw RSS XML via AllOrigins to get 100% of <item> entries in the feed without truncation
  try {
    const xmlRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(f.url)}`)
    if (xmlRes.ok) {
      const xmlText = await xmlRes.text()
      const parsed = parseRssXmlItems(xmlText, f.source, f.slot)
      if (parsed.length > 0) return parsed
    }
  } catch {
    // Fall through to rss2json
  }

  // 2. Fallback to rss2json
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(f.url)}`)
    if (!res.ok) return []
    const data = (await res.json()) as {
      items?: { title?: string; description?: string; content?: string; link?: string; pubDate?: string }[]
    }
    return (data.items ?? []).map((it) => {
      const title = stripHtml(it.title ?? '')
      const rawBody = (it.content && it.content.length > (it.description?.length ?? 0)) ? it.content : (it.description ?? '')
      const summary = stripHtml(rawBody)
        .replace(/The post .*? appeared first on CityNews.*$/i, '')
        .trim()
        .slice(0, 900)
      return {
        title,
        titleZh: '',
        summary,
        link: it.link ?? '',
        source: f.source,
        category: classifyClientArticle(title, summary, f.slot),
        publishedAt: it.pubDate ?? new Date().toISOString(),
      } satisfies RadioLiveArticle
    })
  } catch {
    return []
  }
}

async function translateArticlesBatch(articles: RadioLiveArticle[]): Promise<void> {
  const batchSize = 10
  await Promise.all(
    Array.from({ length: Math.ceil(articles.length / batchSize) }, async (_, bIdx) => {
      const slice = articles.slice(bIdx * batchSize, (bIdx + 1) * batchSize)
      const [zhTitles, zhSummaries] = await Promise.all([
        translateEnToZh(slice.map((a) => a.title.replace(/\n/g, ' ')).join('\n')),
        translateEnToZh(slice.map((a) => a.summary.replace(/\n/g, ' ')).join('\n')),
      ])
      const titleLines = zhTitles ? zhTitles.split('\n') : []
      const summaryLines = zhSummaries ? zhSummaries.split('\n') : []
      slice.forEach((art, idx) => {
        if (titleLines[idx]) art.titleZh = titleLines[idx].trim()
        if (summaryLines[idx]) art.summaryZh = summaryLines[idx].trim()
      })
    }),
  )
}

async function fetchBrowserLiveBulletin(): Promise<RadioBulletin | null> {
  try {
    const weatherPromise = fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m&timezone=America%2FToronto',
    )
      .then(async (r) => {
        if (!r.ok) return undefined
        const d = (await r.json()) as {
          current?: {
            time: string
            temperature_2m: number
            apparent_temperature: number
            weather_code: number
            wind_speed_10m: number
            wind_gusts_10m: number
            wind_direction_10m: number
          }
        }
        if (!d.current) return undefined
        const cond = describeWmoCode(d.current.weather_code)
        return {
          temperatureC: d.current.temperature_2m,
          feelsLikeC: d.current.apparent_temperature,
          windSpeedKmh: d.current.wind_speed_10m,
          windGustsKmh: d.current.wind_gusts_10m,
          windDirection: degToCardinal(d.current.wind_direction_10m),
          condition: cond.en,
          conditionZh: cond.zh,
          observedAt: d.current.time,
        } satisfies RadioLiveWeather
      })
      .catch(() => undefined)

    const feeds = [
      { url: 'https://toronto.citynews.ca/feed/', source: 'CityNews 680 Toronto', slot: 'Top Headlines' },
      { url: 'https://www.cbc.ca/webfeed/rss/rss-canada-toronto', source: 'CBC Toronto', slot: 'Top Headlines' },
      { url: 'https://www.cbc.ca/webfeed/rss/rss-business', source: 'CBC Business', slot: 'Business News' },
      { url: 'https://www.cbc.ca/webfeed/rss/rss-sports', source: 'CBC Sports', slot: 'Sports & Culture' },
    ]

    const feedPromises = feeds.map((f) => fetchFeedArticlesInBrowser(f))

    const [weather, ...feedLists] = await Promise.all([weatherPromise, ...feedPromises])
    const allArticles: RadioLiveArticle[] = []
    const seen = new Set<string>()
    for (const list of feedLists) {
      for (const a of list) {
        const key = a.title.toLowerCase()
        if (a.title && !seen.has(key)) {
          seen.add(key)
          allArticles.push(a)
        }
      }
    }

    if (!weather && allArticles.length === 0) return null

    await translateArticlesBatch(allArticles)

    const bySlot: Record<string, RadioLiveArticle[]> = {
      'Traffic & Weather': [],
      'Top Headlines': [],
      'Business News': [],
      'Sports & Culture': [],
    }
    for (const art of allArticles) {
      bySlot[art.category] = bySlot[art.category] ?? []
      bySlot[art.category].push(art)
    }
    for (const slot of Object.keys(bySlot)) {
      if (bySlot[slot].length === 0 && allArticles.length > 0) {
        bySlot[slot] = allArticles.slice(0, 2)
      }
    }

    const base = STATION_680_NEWS.wheelSegments
    const segments: RadioNewsWheelSegment[] = await Promise.all(
      base.map(async (fb, idx) => {
        const slotName = ['Traffic & Weather', 'Top Headlines', 'Business News', 'Sports & Culture'][idx]
        const list = bySlot[slotName] ?? []

        if (idx === 0 && (weather || list.length > 0)) {
          const temp = weather ? Math.round(weather.temperatureC) : 12
          const feels = weather ? Math.round(weather.feelsLikeC) : 10
          const wind = weather ? Math.round(weather.windSpeedKmh) : 20
          const gust = weather ? Math.round(weather.windGustsKmh) : 32
          const cond = weather?.condition ?? 'Partly cloudy'
          const condZh = weather?.conditionZh ?? '多云间晴'
          const top = list[0]
          const title = top
            ? `680 Live (${temp}°C ${cond}): ${top.title}`
            : `680 News Live Weather & Traffic: ${temp}°C ${cond} in Toronto`
          const lines = [
            'This is 680 News. Time for traffic and weather together on the 1s.',
            `Over at Toronto Pearson International Airport and downtown Toronto, current conditions are ${cond.toLowerCase()} at ${temp} degrees Celsius, feeling like ${feels}, with ${weather?.windDirection ?? 'westerly'} winds at ${wind} kilometers an hour and gusts up to ${gust}.`,
            ...list.slice(0, 2).map((a) => `${a.title}. ${a.summary}`),
          ]
          const text = lines.join(' ')
          const [titleZh, textZh] = await Promise.all([
            top ? translateEnToZh(title) : Promise.resolve(`680 实时路况与气象：多伦多当前 ${temp}°C ${condZh}（体感 ${feels}°C）`),
            translateEnToZh(text),
          ])
          return {
            ...fb,
            title,
            titleZh: titleZh || `680 实时路况与气象：多伦多当前 ${temp}°C ${condZh}`,
            text,
            textZh: textZh || fb.textZh,
            publishedAt: top?.publishedAt ?? new Date().toISOString(),
            sourceUrl: top?.link ?? 'https://toronto.citynews.ca/traffic/',
            sourceName: top?.source ?? 'CityNews 680 Traffic & Weather',
            relatedArticles: list,
          }
        }

        if (list.length === 0) return fb
        const top = list[0]
        const leadIns = [
          'This is 680 News.',
          'From the 680 Newsroom, checking top breaking stories across the Greater Toronto Area.',
          'In 680 Business, tracking the latest market and economic developments.',
          'In 680 Sports and Metro Culture, here is what is happening around Toronto and across the leagues.',
        ]
        const text = [
          leadIns[idx],
          ...list.slice(0, 3).map((a) => `${a.title}. ${a.summary}`),
          'Stay tuned to 680 NewsRadio Toronto for continuous live coverage.',
        ].join(' ')
        const [titleZh, textZh] = await Promise.all([
          top.titleZh ? Promise.resolve(top.titleZh) : translateEnToZh(top.title),
          translateEnToZh(text),
        ])
        return {
          ...fb,
          title: top.title,
          titleZh: titleZh || top.title,
          text,
          textZh: textZh || fb.textZh,
          publishedAt: top.publishedAt,
          sourceUrl: top.link,
          sourceName: top.source,
          relatedArticles: list,
        }
      }),
    )

    return {
      updatedAt: new Date().toISOString(),
      source: 'CityNews 680 Toronto / CBC / Open-Meteo Live',
      isLive: true,
      weather,
      segments,
      liveArticles: allArticles,
    }
  } catch {
    return null
  }
}

export type LiveStreamStation = {
  id: string
  name: string
  callSign: string
  frequency: string
  market: string
  marketZh: string
  format: string
  formatZh: string
  slogan: string
  sloganZh: string
  primaryStreamUrl: string
  secondaryStreamUrl: string
  officialWebUrl: string
  radioplayerUrl: string
  description: string
  descriptionZh: string
  wheelFeatures: {
    title: string
    titleZh: string
    timeSlot: string
    minutes: number[]
    desc: string
    descZh: string
  }[]
  wheelSegments: RadioNewsWheelSegment[]
}

export const STATION_680_NEWS: LiveStreamStation = {
  id: 'cftr-680-news',
  name: '680 NewsRadio Toronto',
  callSign: 'CFTR 680 AM',
  frequency: '680 AM',
  market: 'Toronto & Greater Toronto Area (GTA)',
  marketZh: '加拿大多伦多及大多伦多都会区 (GTA)',
  format: '24/7 All-News Radio',
  formatZh: '24 小时全天候纯新闻广播',
  slogan: 'All news, traffic and weather, all the time · Traffic & Weather on the 1s',
  sloganZh: '全天候新闻、交通与天气 · 尾数逢 1 分准时播报路况与气象',
  primaryStreamUrl: 'https://rogers-hls.leanstream.co/rogers/tor680.stream/playlist.m3u8',
  secondaryStreamUrl: 'https://rogers-hls.leanstream.co:8000/rogers/tor680.stream/48k/playlist.m3u8',
  officialWebUrl: 'https://toronto.citynews.ca/audio/',
  radioplayerUrl: 'https://player.radioplayer.ca/',
  description:
    'CFTR 680 NewsRadio (CityNews 680) is Canada’s flagship 24/7 all-news radio station broadcasting on 680 kHz AM from Toronto. Renowned for its tight, high-energy format featuring Traffic and Weather together on the 1s, business at :26 and :56, and continuous breaking local bulletins.',
  descriptionZh:
    'CFTR 680 NewsRadio（前身为 680 NEWS，现 CityNews 680）是加拿大最著名的 24 小时全天候全新闻广播电台，覆盖大多伦多地区。以标志性的“尾数逢 1 分路况天气连播”、:26/:56 财经专栏以及高语速、高信息密度的即时突发报道著称，是学习真实纯正北美英语听力与地道日常词汇的绝佳语料。',
  wheelFeatures: [
    {
      title: 'Traffic & Weather',
      titleZh: '全城路况与气象即时连报',
      timeSlot: 'Traffic & Weather',
      minutes: [1, 11, 21, 31, 41, 51],
      desc: 'Live airborne traffic cameras over the DVP, Gardiner, Highway 401, plus instant GTA weather radars.',
      descZh: '全城路况探头与机载巡航实时播报 DVP、Gardiner 高速、401 高速通行状况，连线环境部气象雷达。',
    },
    {
      title: 'Top Headlines',
      titleZh: '大都会与全国要闻总览',
      timeSlot: 'Top Headlines',
      minutes: [0, 30],
      desc: 'Top breaking news across Toronto City Hall, Queen’s Park provincial politics, and Ottawa federal affairs.',
      descZh: '市政厅最新决议、安省议会与加拿大联邦重要政策、突发公共事件即时连线。',
    },
    {
      title: 'Business & Market Pulse',
      titleZh: '财经脉搏：多伦多证券交易所与央行决议',
      timeSlot: 'Business News',
      minutes: [26, 56],
      desc: 'Bay Street financial wrap, Bank of Canada interest rate decisions, inflation, housing, and the Canadian dollar.',
      descZh: '多伦多证券交易所 (TSX)、加拿大央行利率决议、房贷基准利率、通胀率与加元汇率深度述评。',
    },
    {
      title: 'Sports & Metro Culture',
      titleZh: '体育速递与城市文化',
      timeSlot: 'Sports & Culture',
      minutes: [15, 45],
      desc: 'Toronto Blue Jays, Maple Leafs, Raptors score updates and weekend festivals around the harborfront.',
      descZh: '多伦多蓝鸟棒球队、枫叶冰球队、猛龙篮球队赛况速递与湖滨周末集市活动。',
    },
  ],
  wheelSegments: [
    {
      id: 'seg-680-traffic-weather',
      timeMark: 'Traffic & Weather',
      title: '680 News Live Traffic & Weather: DVP Slowdown & Pearson Winds',
      titleZh: '680 News 即时路况与天气：DVP 拥堵缓行与皮尔逊机场阵风',
      anchor: 'Stephanie Smyth & Kevin Misener',
      startSecond: 0,
      endSecond: 80,
      text: 'This is 680 News. Time for traffic and weather together on the 1s. In the 680 News airborne traffic chopper, we are watching a sluggish inbound commute on the Don Valley Parkway approaching the Bloor Viaduct due to earlier road maintenance. The Gardiner Expressway is moving at posted speeds through downtown. Over at Toronto Pearson International Airport, southwesterly crosswinds are gusting up to 45 kilometers an hour with light precipitation moving through the western suburbs. Expect traffic to remain clogged near arterial junctions.',
      textZh: '这里是 680 News，现在是路况与天气连报时间。680 News 空中巡航直升机显示：受先前道路养护影响，进城方向的唐河谷高架路（DVP）在接近布卢尔高架桥路段车速缓慢；加德纳高速市中心路段目前按限速正常通行。多伦多皮尔逊国际机场方面，西南向侧风阵风达每小时 45 公里，西郊上空有零星弱降水云系移过。预计主干道交叉口一带路况仍将拥堵。',
      liaisons: [
        {
          phrase: 'watching a',
          ipa: '/ˈwɒ.tʃɪŋ.ə/',
          noteZh: '连读：-ing 与 a 相连，听起来像 “watchin-a”',
          note: 'Linking: “-ing” runs into “a”',
        },
        {
          phrase: 'crosswinds are',
          ipa: '/ˈkrɒs.wɪndz.ɑː/',
          noteZh: '连读：词尾 /z/ 与 are 相连，are 弱读',
          note: 'Linking: final /z/ joins “are”, which is reduced',
        },
      ],
      keyLexis: [
        {
          word: 'commute',
          pos: 'n./v.',
          ipa: '/kəˈmjuːt/',
          meaning: '通勤，上下班路程；往返上下班',
          band: 'Band 6.0',
          contextSnippet: 'A sluggish inbound commute on the Don Valley Parkway approaching downtown.',
        },
        {
          word: 'sluggish',
          pos: 'adj.',
          ipa: '/ˈslʌɡ.ɪʃ/',
          meaning: '缓慢的，行动迟缓的，萧条的',
          band: 'Band 7.0',
          contextSnippet: 'Traffic is sluggish approaching the viaduct due to earlier maintenance.',
        },
        {
          word: 'precipitation',
          pos: 'n.',
          ipa: '/prɪˌsɪp.ɪˈteɪ.ʃən/',
          meaning: '降水（雨、雪等），降水量',
          band: 'Band 7.5',
          contextSnippet: 'Light precipitation is moving through the western suburbs this morning.',
        },
        {
          word: 'clog',
          pos: 'v./n.',
          ipa: '/klɒɡ/',
          meaning: '堵塞，阻塞，使停滞',
          band: 'Band 6.5',
          contextSnippet: 'Stalled vehicles can quickly clog essential arterial collector lanes.',
        },
      ],
    },
    {
      id: 'seg-680-metro-bulletin',
      timeMark: 'Top Headlines',
      title: 'Toronto Metro News: Waterfront Transit Expansion & Housing Density Bylaw',
      titleZh: '多伦多大都会要闻：湖滨轻轨绿化延伸线与居住密度新附例',
      anchor: 'Richard Southern & Carl Hanstke',
      startSecond: 80,
      endSecond: 175,
      text: 'Good morning from the 680 Newsroom. Breaking news at City Hall: Council has voted overwhelmingly to expedite funding for the Waterfront East light rail corridor, linking downtown Union Station to newly revitalized port land districts. Municipal planners emphasize that new mixed-use residential zoning bylaws will mandate 20 percent affordable units alongside pedestrianized public squares and protected bike tracks.',
      textZh: '680 新闻编辑室早间通报。市政厅最新进展：市议会以压倒性多数投票通过，加快对湖滨东区轻轨走廊的资金拨付，打通联合车站（Union Station）至全新修缮的港口工业园区。市政规划师强调，新的商住混合分区规划附例将强制规定 20% 的保障性住房配比，并同步配建步行公共广场和隔离自行车道。',
      liaisons: [
        {
          phrase: 'voted to',
          ipa: '/ˈvəʊ.tɪd.tə/',
          noteZh: '弱读：to 读作 /tə/，t 轻快闪音',
          note: 'Reduction: “to” becomes /tə/',
        },
        {
          phrase: 'light rail',
          ipa: '/laɪt reɪl/',
          noteZh: '连读：light 词尾 /t/ 轻化，与 rail 衔接',
          note: 'Linking: final /t/ of “light” is softened',
        },
      ],
      keyLexis: [
        {
          word: 'expedite',
          pos: 'v.',
          ipa: '/ˈek.spə.daɪt/',
          meaning: '加速，加快处理',
          band: 'Band 7.5',
          contextSnippet: 'Council voted to expedite funding for the light rail transit corridor.',
        },
        {
          word: 'municipal',
          pos: 'adj.',
          ipa: '/mjuːˈnɪs.ɪ.pəl/',
          meaning: '市政的，地方自治的',
          band: 'Band 7.0',
          contextSnippet: 'Municipal planners emphasize modern mixed-use zoning bylaws.',
        },
        {
          word: 'bylaw',
          pos: 'n.',
          ipa: '/ˈbaɪ.lɔː/',
          meaning: '地方法规，城市管理附例',
          band: 'Band 7.0',
          contextSnippet: 'New zoning bylaws mandate affordable residential units in the district.',
        },
        {
          word: 'revitalize',
          pos: 'v.',
          ipa: '/riːˈvaɪ.təl.aɪz/',
          meaning: '使复兴，赋予新生，活化',
          band: 'Band 7.5',
          contextSnippet: 'Linking downtown transit directly to revitalized port land sectors.',
        },
      ],
    },
    {
      id: 'seg-680-business-pulse',
      timeMark: 'Business News',
      title: '680 Business Pulse: TSX Trading & Bank of Canada Policy Rate Outlook',
      titleZh: '680 商业财经专栏：多伦多股市与加拿大央行基准利率预期',
      anchor: 'Mike Eppel (Senior Business Editor)',
      startSecond: 175,
      endSecond: 265,
      text: 'In 680 Business, checking Bay Street numbers: the TSX Composite index opened higher by 85 points, buoyed by mining equities and renewable utilities. On the macroeconomic horizon, economists at major Canadian financial institutions anticipate that the Bank of Canada will hold its benchmark policy rate steady at their upcoming announcement, as annualized core inflation cools toward the two percent target band.',
      textZh: '680 商业财经专栏，来看多伦多贝街金融走势：在采矿业与可再生公用事业板块提振下，多伦多证券交易所综合指数开盘上涨 85 点。宏观经济方面，加拿大主流金融机构经济学家预计，随着年化核心通胀率稳步回落至 2% 的目标区间，加拿大央行将在即将公布的决议中维持基准政策利率不变。',
      liaisons: [
        {
          phrase: 'held steady',
          ipa: '/held ˈsted.i/',
          noteZh: '连读：held 词尾 /d/ 与 steady 衔接',
          note: 'Linking: /d/ of “held” joins “steady”',
        },
        {
          phrase: 'opened higher',
          ipa: '/ˈəʊ.pənd ˈhaɪ.ər/',
          noteZh: '连读：opened 词尾 /d/ 弱化',
          note: 'Reduction: final /d/ of “opened” is weakened',
        },
      ],
      keyLexis: [
        {
          word: 'benchmark',
          pos: 'n./adj.',
          ipa: '/ˈbentʃ.mɑːk/',
          meaning: '基准，标杆；基准的',
          band: 'Band 7.0',
          contextSnippet: 'The central bank is expected to hold its benchmark policy rate steady.',
        },
        {
          word: 'buoy',
          pos: 'v.',
          ipa: '/bɔɪ/',
          meaning: '提振，鼓励，使浮起',
          band: 'Band 8.0',
          contextSnippet: 'The stock exchange opened higher, buoyed by energy and mining equities.',
        },
        {
          word: 'equity',
          pos: 'n.',
          ipa: '/ˈek.wɪ.ti/',
          meaning: '股票，股权；公平，公正',
          band: 'Band 7.0',
          contextSnippet: 'Strong gains in utility equities led morning trading sessions.',
        },
        {
          word: 'inflation',
          pos: 'n.',
          ipa: '/ɪnˈfleɪ.ʃən/',
          meaning: '通货膨胀，物价上涨',
          band: 'Band 6.5',
          contextSnippet: 'Core inflation figures continue to align with long-term economic targets.',
        },
      ],
    },
    {
      id: 'seg-680-lifestyle-weather',
      timeMark: 'Sports & Culture',
      title: '680 News Metro Culture: Clear Skies & Harborfront Weekend Guide',
      titleZh: '680 News 文化与气象展望：晴朗气温与多伦多湖滨漫步指南',
      anchor: 'Jill Taylor & Newsroom Team',
      startSecond: 265,
      endSecond: 360,
      text: 'Taking a look ahead at your weekend forecast: high pressure over Southern Ontario will deliver sunny conditions with temperatures reaching a pleasant 21 degrees Celsius on Sunday. Ideal weather for visitors exploring the Kensington Market pedestrian fair and waterfront artisan markets. Stay tuned right here to 680 News for uninterrupted updates, round the clock, every ten minutes on the 1s.',
      textZh: '来看周末天气展望：安大略省南部受高压脊控制，全区将迎来晴好天气，周日最高气温将达到舒适的 21 摄氏度。非常适宜市民前往肯辛顿市集（Kensington Market）步行街区与湖滨文创市集游览。请持续锁定 680 News，全天候 24 小时、每 10 分钟逢 1 分不间断为您带来最新路况与天气。',
      liaisons: [
        {
          phrase: 'high pressure',
          ipa: '/haɪ ˈpreʃ.ər/',
          noteZh: '节奏：重音落在 high 与 pres-',
          note: 'Stress: falls on “high” and “pres-”',
        },
        {
          phrase: 'round the clock',
          ipa: '/raʊnd ðə klɒk/',
          noteZh: '弱读：the 读作 /ðə/，连成一个节奏组',
          note: 'Reduction: “the” is /ðə/, one rhythm group',
        },
      ],
      keyLexis: [
        {
          word: 'forecast',
          pos: 'n./v.',
          ipa: '/ˈfɔː.kɑːst/',
          meaning: '天气预报，预测',
          band: 'Band 6.0',
          contextSnippet: 'Taking a look ahead at your four-day weekend forecast across the region.',
        },
        {
          word: 'artisan',
          pos: 'n./adj.',
          ipa: '/ˌɑː.tɪˈzæn/',
          meaning: '手工艺人，工匠；手作的',
          band: 'Band 7.5',
          contextSnippet: 'Waterfront artisan vendors will set up stalls along Queen’s Quay.',
        },
        {
          word: 'uninterrupted',
          pos: 'adj.',
          ipa: '/ˌʌn.ɪn.təˈrʌp.tɪd/',
          meaning: '不间断的，连续的',
          band: 'Band 7.0',
          contextSnippet: 'Stay tuned for uninterrupted news and traffic updates around the clock.',
        },
      ],
    },
  ],
}
