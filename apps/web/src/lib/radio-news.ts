import { getDictionaryEntry } from '@/lib/dictionary'

export type RadioVocabularyItem = {
  word: string
  pos: string
  ipa: string
  meaning: string
  band: string
  contextSnippet: string
}

export type RadioCollocationItem = {
  phrase: string
  patternZh: string
  patternEn: string
  meaningZh: string
  meaningEn: string
  usageZh: string
  usageEn: string
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

export type RadioHourlyForecastItem = {
  timeLabel: string
  tempC: number
  feelsLikeC: number
  precipProbPct: number
  weatherCode: number
}

export type RadioLiveWeather = {
  temperatureC: number
  feelsLikeC: number
  windSpeedKmh: number
  windGustsKmh: number
  windDirection: string
  windCompass?: string
  condition: string
  conditionZh: string
  observedAt: string
  weatherCode?: number
  highC?: number
  lowC?: number
  yesterdayHighC?: number
  yesterdayLowC?: number
  yesterdayLabel?: string
  sunrise?: string
  sunset?: string
  pressureKpa?: number
  humidityPct?: number
  visibilityKm?: number
  ceilingM?: number
  precipAlertEn?: string
  precipAlertZh?: string
  hourlySummaryEn?: string
  hourlySummaryZh?: string
  hourly?: RadioHourlyForecastItem[]
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

const RADIO_CACHE_KEY = 'projectdesk.radio.citynews680.v7'

const COMMON_NEWS_IPA: Record<string, string> = {
  framework: '/ˈfreɪm.wɜːk/',
  possibility: '/ˌpɒs.əˈbɪl.ə.ti/',
  discussion: '/dɪˈskʌʃ.ən/',
  security: '/sɪˈkjʊə.rə.ti/',
  benefit: '/ˈben.ɪ.fɪt/',
  weaken: '/ˈwiː.kən/',
  reshape: '/ˌriːˈʃeɪp/',
  continent: '/ˈkɒn.tɪ.nənt/',
  border: '/ˈbɔː.dər/',
  effort: '/ˈef.ət/',
  stoppage: '/ˈstɒp.ɪdʒ/',
  disruption: '/dɪsˈrʌp.ʃən/',
  departure: '/dɪˈpɑː.tʃər/',
  normal: '/ˈnɔː.məl/',
  authority: '/ɔːˈθɒr.ə.ti/',
  passenger: '/ˈpæs.ən.dʒər/',
  cancel: '/ˈkæn.səl/',
  delay: '/dɪˈleɪ/',
  facility: '/fəˈsɪl.ə.ti/',
  statement: '/ˈsteɪt.mənt/',
  dangerous: '/ˈdeɪn.dʒər.əs/',
  reporter: '/rɪˈpɔː.tər/',
  agenda: '/əˈdʒen.də/',
  embargo: '/ɪmˈbɑː.ɡəʊ/',
  exclusively: '/ɪkˈskluː.sɪv.li/',
  exclusive: '/ɪkˈskluː.sɪv/',
  inflation: '/ɪnˈfleɪ.ʃən/',
  mortgage: '/ˈmɔː.ɡɪdʒ/',
  collision: '/kəˈlɪʒ.ən/',
  investigation: '/ɪnˌves.tɪˈɡeɪ.ʃən/',
  emergency: '/ɪˈmɜː.dʒən.si/',
  suspect: '/ˈsʌs.pekt/',
  legislation: '/ˌledʒ.ɪsˈleɪ.ʃən/',
  provincial: '/prəˈvɪn.ʃəl/',
  municipal: '/mjuːˈnɪs.ɪ.pəl/',
  corridor: '/ˈkɒr.ɪ.dɔːr/',
}

const RADIO_BOILERPLATE_STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'would', 'could', 'should', 'your', 'here', 'more', 'most',
  'when', 'what', 'were', 'been', 'they', 'their', 'there', 'where', 'which', 'while', 'about', 'after',
  'before', 'under', 'over', 'into', 'also', 'some', 'such', 'than', 'then', 'them', 'these', 'those', 'both',
  'each', 'other', 'only', 'very', 'just', 'even', 'back', 'down', 'well', 'much', 'many', 'made', 'make',
  'take', 'took', 'taken', 'come', 'came', 'goes', 'went', 'gone', 'know', 'knew', 'known', 'said', 'says',
  'told', 'tell', 'year', 'years', 'week', 'weeks', 'month', 'months', 'time', 'times', 'news', 'toronto',
  'canada', 'canadian', 'ontario', 'city', 'stay', 'tuned', 'live', 'latest', 'checking', 'stories', 'greater',
  'area', 'degree', 'degrees', 'celsius', 'hour', 'hours', 'kilometer', 'kilometers', 'newsroom', 'pearson',
  'international', 'airport', 'downtown', 'current', 'conditions', 'feeling', 'like', 'winds', 'together',
  'newsradio', 'continuous', 'coverage', 'tracking', 'happening', 'around', 'across', 'leagues', 'monday',
  'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april',
  'june', 'july', 'august', 'september', 'october', 'november', 'december', 'united', 'states', 'ukraine',
  'ukrainian', 'russia', 'russian', 'moscow', 'kyiv', 'europe', 'european', 'putin', 'zelenskyy', 'volodymyr',
  'traffic', 'weather', 'business', 'sports', 'culture', 'metro', 'market', 'economic', 'developments',
  'breaking', 'northerly', 'northeasterly', 'easterly', 'southeasterly', 'southerly', 'southwesterly',
  'westerly', 'northwesterly', 'first', 'second', 'third', 'three', 'four', 'five', 'seven', 'eight', 'nine',
  'president', 'official', 'officials', 'people', 'country', 'countries', 'government', 'minister', 'american',
  'americans', 'vladimir', 'cloudy', 'partly',
])

function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+/g)
  if (!raw || raw.length === 0) return [text.trim()].filter(Boolean)
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

function isBoilerplateSentence(sentence: string): boolean {
  const low = sentence.toLowerCase()
  return (
    low.startsWith('this is 680 news') ||
    low.startsWith('time for traffic and weather') ||
    low.startsWith('from the 680 newsroom') ||
    low.startsWith('in 680 business') ||
    low.startsWith('in 680 sports') ||
    low.startsWith('stay tuned to 680')
  )
}

function formatCleanSnippet(rawSentence: string, target: string, maxLen = 140): string {
  const s = rawSentence
    .replace(/^[A-Z][A-Za-z\s,.]{2,35}(?:\([A-Za-z0-9\s]+\))?\s*[—–-]\s*/, '')
    .trim()
  if (s.length <= maxLen) return s

  const idx = s.toLowerCase().indexOf(target.toLowerCase())
  if (idx === -1 || idx + target.length <= maxLen - 15) {
    return truncateCleanSentence(s, maxLen)
  }

  // Target appears later in a long sentence: start at the nearest clause boundary before target
  const before = s.slice(0, idx)
  const clauseStart = Math.max(before.lastIndexOf(', '), before.lastIndexOf('; '), before.lastIndexOf(' — '))
  if (clauseStart >= 15 && s.length - (clauseStart + 2) <= maxLen + 20) {
    const tail = s.slice(clauseStart + 2).trim()
    return `...${truncateCleanSentence(tail, maxLen)}`
  }

  const windowStart = Math.max(0, idx - 35)
  const spaceIdx = s.indexOf(' ', windowStart)
  const start = spaceIdx !== -1 && spaceIdx < idx ? spaceIdx + 1 : windowStart
  return `...${truncateCleanSentence(s.slice(start).trim(), maxLen)}`
}

export function extractLiveKeyLexis(text: string): RadioVocabularyItem[] {
  const allSentences = splitIntoSentences(text)
  const storySentences = allSentences.filter((s) => !isBoilerplateSentence(s))
  const targetSentences = storySentences.length > 0 ? storySentences : allSentences
  const searchPoolText = targetSentences.join(' ')

  const tokenMatches = searchPoolText.match(/[A-Za-z]{5,}/g) ?? []
  const seenWords = new Set<string>()
  const candidates: { item: RadioVocabularyItem; score: number }[] = []

  for (const rawTok of tokenMatches) {
    const low = rawTok.toLowerCase()
    if (RADIO_BOILERPLATE_STOPWORDS.has(low) || seenWords.has(low)) continue

    const sentence =
      targetSentences.find((s) => new RegExp(`\\b${rawTok}\\b`, 'i').test(s)) ??
      allSentences.find((s) => new RegExp(`\\b${rawTok}\\b`, 'i').test(s)) ??
      targetSentences[0] ??
      text

    const dictEntry = getDictionaryEntry(low, [], sentence)
    if (
      !dictEntry ||
      dictEntry.meaningZh.startsWith('专有名词') ||
      dictEntry.meaningZh.startsWith('暂无')
    ) {
      continue
    }

    const rootWord = dictEntry.contextNote?.startsWith('词根：')
      ? dictEntry.contextNote.slice(3).trim().toLowerCase()
      : dictEntry.word.toLowerCase()

    if (RADIO_BOILERPLATE_STOPWORDS.has(rootWord) || seenWords.has(rootWord)) continue
    seenWords.add(low)
    seenWords.add(rootWord)

    const resolvedIpa =
      dictEntry.ipa !== `/${dictEntry.word}/` && dictEntry.ipa !== `/${low}/`
        ? dictEntry.ipa
        : COMMON_NEWS_IPA[rootWord] ?? COMMON_NEWS_IPA[low] ?? dictEntry.ipa

    // Prefer words from the actual news headline/story over the weather intro sentence
    const inNewsBody = !sentence.toLowerCase().startsWith('over at toronto pearson')
    const hasRealIpa = resolvedIpa !== `/${dictEntry.word}/` && resolvedIpa !== `/${low}/`
    const score =
      (inNewsBody ? 20 : 0) +
      (hasRealIpa ? 15 : 0) +
      Math.min(12, low.length)

    candidates.push({
      score,
      item: {
        word: rootWord,
        pos: dictEntry.pos === 'n. pl.' ? 'n.' : dictEntry.pos,
        ipa: resolvedIpa,
        meaning: dictEntry.meaningZh,
        band: dictEntry.band,
        contextSnippet: formatCleanSnippet(sentence, rawTok, 140),
      },
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, 4).map((c) => c.item)
}

function shortChineseGloss(rawZh: string): string {
  return rawZh
    .replace(/^[a-z./]+\s*/i, '')
    .split(/[；;，,（(]/)[0]
    .trim()
}

export function extractLiveCollocations(text: string): RadioCollocationItem[] {
  const allSentences = splitIntoSentences(text)
  const storySentences = allSentences.filter(
    (s) => !isBoilerplateSentence(s) && !s.toLowerCase().startsWith('over at toronto pearson'),
  )
  const targetSentences = storySentences.length > 0 ? storySentences : allSentences
  const searchPoolText = targetSentences.join(' ')

  const findSentenceForPhrase = (phrase: string): string => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'i')
    const hit =
      targetSentences.find((s) => re.test(s)) ??
      allSentences.find((s) => re.test(s)) ??
      targetSentences[0] ??
      text
    return formatCleanSnippet(hit, phrase, 135)
  }

  const out: RadioCollocationItem[] = []
  const seenPhrases = new Set<string>()

  const pushCard = (card: Omit<RadioCollocationItem, 'contextSnippet'>) => {
    const norm = card.phrase.toLowerCase().trim()
    if (!norm || seenPhrases.has(norm)) return
    seenPhrases.add(norm)
    out.push({
      ...card,
      contextSnippet: findSentenceForPhrase(card.phrase),
    })
  }

  // Tier 1: High-yield journalism & IELTS collocation patterns present in the live news text
  const curatedPatterns: {
    re: RegExp
    build: (match: RegExpExecArray) => Omit<RadioCollocationItem, 'contextSnippet'>
  }[] = [
    {
      re: /\b(raise[ds]?|raising)\s+the\s+(possibility|prospect|question|issue|risk|alarm|stakes|concern[s]?)\s+(of|that|over|about)\b/gi,
      build: (m) => ({
        phrase: m[0].trim(),
        patternZh: 'v. + n. + prep. 动词短语搭配',
        patternEn: 'Verb + Noun + Prep',
        meaningZh: `提出…的${m[2].toLowerCase().startsWith('possib') || m[2].toLowerCase() === 'prospect' ? '可能性' : '问题/关切'}；引发对…的探讨`,
        meaningEn: 'bring up the likelihood, issue, or concern of something happening',
        usageZh: '新闻与雅思写作高分替代词组（替代 maybe / talk about），后接名词或动名词。',
        usageEn: 'High-register journalism and IELTS Writing expression followed by a noun or gerund.',
        band: 'Band 7.5',
      }),
    },
    {
      re: /\bas\s+part\s+of\s+(?:[a-z]+\s+)?(efforts|plans|measures|talks|initiatives|push|drive)\s+to\s+([a-z]+)\b/gi,
      build: (m) => {
        const verbEntry = getDictionaryEntry(m[2].toLowerCase(), [], m[0])
        const verbZh =
          verbEntry && !verbEntry.meaningZh.startsWith('专有名词')
            ? shortChineseGloss(verbEntry.meaningZh)
            : ''
        return {
          phrase: m[0].trim(),
          patternZh: 'prep. + n. + to do 目的状语搭配',
          patternEn: 'Prep + Noun + Infinitive',
          meaningZh: `作为致力于${verbZh || '实现某目标'}的努力/举措的一部分`,
          meaningEn: 'as one component of broader organized attempts to achieve a goal',
          usageZh: '新闻报道常用此句型引出政策、法案或外交行动背后的核心目标。',
          usageEn: 'Used in news reporting to frame the strategic goal behind an action or policy.',
          band: 'Band 7.5',
        }
      },
    },
    {
      re: /\b(security\s+framework|legal\s+framework|regulatory\s+framework|policy\s+framework)\b/gi,
      build: (m) => ({
        phrase: m[0].trim(),
        patternZh: 'n. + n. 核心复合名词搭配',
        patternEn: 'Noun + Noun Collocation',
        meaningZh: m[0].toLowerCase().startsWith('security') ? '安全框架，安保体系架构' : '法律/监管制度框架',
        meaningEn: 'a structured system of agreements, rules, or safeguards',
        usageZh: '常与 establish / reshape / broader / new 搭配，用于国际关系与公共政策语境。',
        usageEn: 'Frequently paired with establish, reshape, or propose in policy contexts.',
        band: 'Band 7.5',
      }),
    },
    {
      re: /\b(floated|backed|sparked|triggered|prompted|fueled|plagued|unveiled|launched|issued)\s+by\b/gi,
      build: (m) => {
        const v = m[1].toLowerCase()
        const isFloat = v === 'floated'
        const vEntry = getDictionaryEntry(v, [], m[0])
        const vZh = isFloat
          ? '初步提出（方案/构想）以试探反应'
          : vEntry && !vEntry.meaningZh.startsWith('专有名词')
            ? shortChineseGloss(vEntry.meaningZh)
            : '推动/引发'
        return {
          phrase: m[0].trim(),
          patternZh: 'v.-ed + prep. 后置分词搭配',
          patternEn: 'Participle + Prep',
          meaningZh: isFloat ? '由…初步提出（方案/设想），放风试探' : `由…所${vZh}（被动后置修饰）`,
          meaningEn: isFloat
            ? 'put forward tentatively to test reaction'
            : `initiated, supported, or caused by an agent`,
          usageZh: isFloat
            ? '熟词僻义：float 在政经新闻中常表示“提出（想法或提案）”，如 a framework floated by US。'
            : `新闻标题与导语高频精简结构，省略 which was 直接用 “${m[0].trim()}” 作后置定语。`,
          usageEn: 'Compact broadcast journalism passive modifier.',
          band: 'Band 7.5',
        }
      },
    },
    {
      re: /\b(weaken|reshape|strengthen|bolster|undermine|disrupt|restore|expand|curb|tackle|address)\s+(?:the\s+|such\s+|their\s+|its\s+)?([a-z']+(?:\s+[a-z']+)?)\b/gi,
      build: (m) => {
        const vLow = m[1].toLowerCase()
        const objRaw = m[2].trim()
        const objLastWord = objRaw.split(/\s+/).pop()?.replace(/[^a-z]/gi, '').toLowerCase() ?? ''
        const vEntry = getDictionaryEntry(vLow, [], m[0])
        const oEntry = objLastWord ? getDictionaryEntry(objLastWord, [], m[0]) : null
        const vZh = vEntry ? shortChineseGloss(vEntry.meaningZh) : vLow
        const oZh =
          oEntry && !oEntry.meaningZh.startsWith('专有名词')
            ? shortChineseGloss(oEntry.meaningZh)
            : objRaw
        return {
          phrase: m[0].trim(),
          patternZh: 'v. + n. 动宾核心搭配',
          patternEn: 'Verb + Object Collocation',
          meaningZh: `${vZh}${oZh}`,
          meaningEn: `${vLow} ${objRaw} (high-impact transitive verb + object)`,
          usageZh: `高分动宾搭配：动词 “${vLow}”（${vZh}）精准搭配宾语 “${objRaw}”，比普通动词更具学术与新闻表现力。`,
          usageEn: `Strong verb-object collocation with "${vLow}".`,
          band: 'Band 7.0',
        }
      },
    },
    {
      re: /\b(ground\s+stop|ripple\s+effect|travel\s+rush|domestic\s+flights|flight\s+disruptions?|air\s+traffic|oil\s+facility|general\s+staff|interest\s+rates?|cost\s+of\s+living|housing\s+market|emergency\s+crews|police\s+investigation|collector\s+lanes|express\s+lanes|transit\s+riders|trade\s+tariffs?|supply\s+chain|public\s+health|city\s+council|executive\s+order|peace\s+talks)\b/gi,
      build: (m) => {
        const raw = m[0].trim()
        const parts = raw.toLowerCase().split(/\s+/)
        const e1 = getDictionaryEntry(parts[0], [], raw)
        const e2 = getDictionaryEntry(parts[parts.length - 1], [], raw)
        const z1 = e1 && !e1.meaningZh.startsWith('专有名词') ? shortChineseGloss(e1.meaningZh) : parts[0]
        const z2 = e2 && !e2.meaningZh.startsWith('专有名词') ? shortChineseGloss(e2.meaningZh) : parts[parts.length - 1]
        const specialMap: Record<string, string> = {
          'ground stop': '地面停飞令（航空管制措施）',
          'ripple effect': '连锁反应，波及效应',
          'travel rush': '出行高峰期，客流高峰',
          'domestic flights': '国内航班',
          'oil facility': '石油设施，炼油与储油基地',
          'general staff': '总参谋部',
          'interest rate': '利率',
          'interest rates': '利率',
          'cost of living': '生活成本',
          'housing market': '房地产市场，楼市',
          'emergency crews': '应急救援人员',
          'collector lanes': '辅路车道，集散车道',
          'express lanes': '快速车道，主路车道',
        }
        return {
          phrase: raw,
          patternZh: 'n. + n. 新闻行业高频词组',
          patternEn: 'Compound Noun Phrase',
          meaningZh: specialMap[raw.toLowerCase()] ?? `${z1}${z2}`,
          meaningEn: `standard journalism compound noun phrase: "${raw}"`,
          usageZh: '北美新闻播报固定复合名词搭配，建议作为整体词块（chunk）记忆。',
          usageEn: 'Fixed compound noun chunk in North American broadcast journalism.',
          band: 'Band 7.0',
        }
      },
    },
    {
      re: /\b(focusing\s+exclusively\s+on|referring\s+to|embargoed\s+until|operating\s+normally|in\s+time\s+to|according\s+to|in\s+response\s+to|ahead\s+of|on\s+the\s+verge\s+of|in\s+the\s+wake\s+of|under\s+investigation)\b/gi,
      build: (m) => {
        const low = m[0].trim().toLowerCase()
        const map: Record<string, { zh: string; usage: string }> = {
          'focusing exclusively on': { zh: '仅仅聚焦于…，专一针对…', usage: 'exclusively 强化聚焦程度，常用于对比两个议题的优先级。' },
          'referring to': { zh: '指的是…，提及…', usage: '新闻引语后常接 referring to... 补充说明发言人所指的具体事物。' },
          'embargoed until': { zh: '（新闻稿）在…之前禁止提前发布', usage: '新闻业专业搭配：embargo 指“新闻解禁时间限制”。' },
          'operating normally': { zh: '恢复正常运行，正常运转', usage: '常用于交通、电网、航空系统恢复后的官方通报。' },
          'in time to': { zh: '及时赶上做某事，来得及…', usage: '后接动词原形，表示在关键节点前完成准备。' },
          'according to': { zh: '据…所说，根据…的数据', usage: '新闻消息源标注最高频介词短语。' },
          'in response to': { zh: '作为对…的回应，应对…', usage: '用于引出政策或反制措施的触发原因。' },
          'ahead of': { zh: '在…之前，早于…', usage: '新闻中常替代 before，如 ahead of the summit / holiday。' },
          'on the verge of': { zh: '濒临…，即将…', usage: '形容局势或协议接近临界点。' },
          'in the wake of': { zh: '随着…之后，在…的影响下', usage: '常接重大事件或危机名词。' },
          'under investigation': { zh: '正在接受调查中', usage: '警务与市政新闻固定表语/后置定语短语。' },
        }
        const info = map[low] ?? { zh: '核心新闻介词/分词短语搭配', usage: '用于衔接新闻事实与背景信息。' }
        return {
          phrase: m[0].trim(),
          patternZh: 'v./prep. 新闻功能短语搭配',
          patternEn: 'Journalism Functional Phrase',
          meaningZh: info.zh,
          meaningEn: `high-frequency broadcast phrase "${m[0].trim()}"`,
          usageZh: info.usage,
          usageEn: 'High-frequency functional phrase in broadcast reporting.',
          band: 'Band 7.0',
        }
      },
    },
  ]

  for (const pat of curatedPatterns) {
    pat.re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pat.re.exec(searchPoolText)) !== null) {
      pushCard(pat.build(match))
      if (out.length >= 4) return out
    }
  }

  // Tier 2: Dynamic Syntactic Collocation Extractor directly from the live news story sentences
  // Scans adjacent content word pairs (Adjective + Noun / Noun + Noun / Verb + Preposition) in the story
  const pairRegex = /\b([A-Za-z]{4,})\s+([a-z]{4,})\b/g
  let pairMatch: RegExpExecArray | null
  while ((pairMatch = pairRegex.exec(searchPoolText)) !== null) {
    if (out.length >= 4) break
    const w1 = pairMatch[1]
    const w2 = pairMatch[2]
    const l1 = w1.toLowerCase()
    const l2 = w2.toLowerCase()
    if (RADIO_BOILERPLATE_STOPWORDS.has(l1) || RADIO_BOILERPLATE_STOPWORDS.has(l2)) continue

    const e1 = getDictionaryEntry(l1, [], pairMatch[0])
    const e2 = getDictionaryEntry(l2, [], pairMatch[0])
    if (
      !e1 ||
      !e2 ||
      e1.meaningZh.startsWith('专有名词') ||
      e2.meaningZh.startsWith('专有名词') ||
      e1.meaningZh.startsWith('暂无') ||
      e2.meaningZh.startsWith('暂无')
    ) {
      continue
    }

    const z1 = shortChineseGloss(e1.meaningZh)
    const z2 = shortChineseGloss(e2.meaningZh)
    if (!z1 || !z2 || z1 === z2) continue

    const phrase = `${w1} ${w2}`
    const isAdjNoun = e1.pos.includes('adj')
    pushCard({
      phrase,
      patternZh: isAdjNoun ? 'adj. + n. 修饰词组搭配' : 'n. + n. 复合词组搭配',
      patternEn: isAdjNoun ? 'Adj + Noun Collocation' : 'Noun + Noun Collocation',
      meaningZh: `${z1} · ${z2}`,
      meaningEn: `${w1} (${e1.pos}) + ${w2} (${e2.pos})`,
      usageZh: `来自当前报道的实词搭配：“${w1.toLowerCase()}”（${z1}）+ “${w2.toLowerCase()}”（${z2}），成块记忆可提升听音辨义速度。`,
      usageEn: `Authentic two-word collocation from the current report.`,
      band: 'Band 7.0',
    })
  }

  return out.slice(0, 4)
}

export function extractLiveLiaisons(text: string): RadioLiaison[] {
  const patterns: { re: RegExp; build: (m: string) => RadioLiaison }[] = [
    {
      re: /\b([a-z]+ing)\s+(a|an|in|on|at|up|out|over|across|into)\b/gi,
      build: (m) => {
        const parts = m.trim().split(/\s+/)
        return {
          phrase: m.trim(),
          ipa: `/...ɪŋ‿${parts[1].toLowerCase()}/`,
          noteZh: `辅元连读：${parts[0]} 词尾鼻音与元音词 “${parts[1]}” 自然连读`,
          note: `Linking: “-ing” flows directly into vowel-initial “${parts[1]}”`,
        }
      },
    },
    {
      re: /\b([a-z]+ed)\s+(to|in|on|at|up|by|as|of)\b/gi,
      build: (m) => {
        const parts = m.trim().split(/\s+/)
        return {
          phrase: m.trim(),
          ipa: `/${parts[0].toLowerCase()}‿${parts[1].toLowerCase()}/`,
          noteZh: `过去式词尾连读与弱读：“${parts[0]}” 词尾轻化并与 “${parts[1]}” 紧密衔接`,
          note: `Past-tense linking & reduction: “${parts[0]}” blends into “${parts[1]}”`,
        }
      },
    },
    {
      re: /\b(part|possibility|instead|out|because|ahead)\s+of\s+(a|an|the|[a-z]+)\b/gi,
      build: (m) => ({
        phrase: m.trim(),
        ipa: `/${m.trim().toLowerCase().replace(/\s+of\s+/, '‿əv‿')}/`,
        noteZh: `高频介词 of 弱读：在新闻快语速中 of 弱化为 /əv/ 或 /ə/ 并前后连读`,
        note: `Reduction: “of” reduces to /əv/ and links smoothly across words`,
      }),
    },
    {
      re: /\b(gusts|winds|flights|talks|efforts|borders)\s+(up|at|in|on|are|to)\b/gi,
      build: (m) => {
        const parts = m.trim().split(/\s+/)
        return {
          phrase: m.trim(),
          ipa: `/${parts[0].toLowerCase()}‿${parts[1].toLowerCase()}/`,
          noteZh: `复数词尾连读：“${parts[0]}” 词尾 /s/ 或 /z/ 与后续功能词 “${parts[1]}” 连读`,
          note: `Plural sibilant linking: final /s/ or /z/ of “${parts[0]}” links into “${parts[1]}”`,
        }
      },
    },
  ]

  const out: RadioLiaison[] = []
  const seen = new Set<string>()
  for (const pat of patterns) {
    const matches = text.match(pat.re) ?? []
    for (const raw of matches) {
      const key = raw.toLowerCase().trim()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(pat.build(raw))
      if (out.length >= 2) return out
    }
  }
  return out
}

function isCityNewsArticle(a: RadioLiveArticle): boolean {
  return a.source.toLowerCase().includes('citynews') || a.link.toLowerCase().includes('citynews.ca')
}

function normalizeDedupTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function normalizeDedupLink(link: string): string {
  return link.toLowerCase().split(/[?#]/)[0].replace(/\/+$/, '').trim()
}

function dedupeArticles(list: RadioLiveArticle[]): RadioLiveArticle[] {
  const seenTitles = new Set<string>()
  const seenLinks = new Set<string>()
  const out: RadioLiveArticle[] = []
  for (const a of list) {
    const tKey = normalizeDedupTitle(a.title)
    const lKey = normalizeDedupLink(a.link)
    if (!tKey || seenTitles.has(tKey) || (lKey && seenLinks.has(lKey))) continue
    seenTitles.add(tKey)
    if (lKey) seenLinks.add(lKey)
    out.push(a)
  }
  return out
}

function padNormalizedWords(s: string): string {
  const norm = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return norm ? ` ${norm} ` : ''
}

function countWholeKeywordHits(padded: string, keywords: readonly string[]): number {
  if (!padded) return 0
  let hits = 0
  for (const kw of keywords) {
    if (padded.includes(` ${kw} `)) hits++
  }
  return hits
}

const TRAFFIC_STRONG_KW = [
  'traffic', 'weather', 'ttc', 'metrolinx', 'gardiner', 'dvp', 'don valley',
  'highway 401', 'highway 400', 'highway 404', 'highway 427', 'qew',
  'go transit', 'up express', 'eglinton crosstown', 'lane closure', 'road closure',
  'ground stop', 'flight delay', 'flight delays', 'flight disruption', 'flight disruptions',
  'air traffic', 'environment canada', 'snowfall', 'heat warning', 'rainfall',
  'thunderstorm', 'blizzard', 'freezing rain', 'wind warning', 'fog advisory', 'shuttle buses',
] as const

const TRAFFIC_MEDIUM_KW = [
  'highway', 'subway', 'streetcar', 'commute', 'commuters', 'collision', 'crash',
  'delays', 'airport', 'pearson', 'flights', 'airline', 'airlines', 'faa',
  'snow', 'rain', 'storm', 'forecast', 'temperature', 'celsius', 'overcast',
  'gusts', 'pedestrian', 'cyclist', 'intersection', 'expressway', 'lanes', 'stoppage',
] as const

const BUSINESS_STRONG_KW = [
  'tsx', 'bank of canada', 'interest rate', 'interest rates', 'inflation', 'gdp',
  'economy', 'economic', 'stock market', 'wall street', 'tariff', 'tariffs',
  'housing market', 'real estate', 'mortgage', 'unemployment', 'cost of living',
  'retail sales', 'trade war', 'central bank', 'loonie', 'oil prices', 'earnings', 'recession',
] as const

const BUSINESS_MEDIUM_KW = [
  'business', 'market', 'markets', 'stocks', 'shares', 'dollar', 'trade',
  'housing', 'rent', 'tenants', 'landlords', 'jobs', 'workers', 'strike',
  'union', 'wages', 'consumers', 'grocery', 'prices', 'affordability',
  'company', 'corporate', 'investors', 'revenue', 'profit', 'bank', 'banking', 'budget', 'tax', 'taxes',
] as const

const SPORTS_STRONG_KW = [
  'maple leafs', 'blue jays', 'raptors', 'argonauts', 'toronto fc', 'tfc',
  'nhl', 'nba', 'mlb', 'nfl', 'cfl', 'wnba', 'sceptres', 'stanley cup',
  'playoffs', 'playoff', 'world series', 'super bowl', 'world cup', 'olympics',
  'tiff', 'concert', 'festival', 'box office', 'grammy', 'oscar', 'juno', 'lottery', 'lotto max',
] as const

const SPORTS_MEDIUM_KW = [
  'hockey', 'baseball', 'basketball', 'soccer', 'football', 'tennis', 'golf',
  'athlete', 'coach', 'stadium', 'arena', 'scotiabank arena', 'rogers centre',
  'bmo field', 'tournament', 'championship', 'roster', 'museum', 'gallery',
  'theatre', 'music', 'culture', 'entertainment', 'celebrity', 'movie', 'film', 'weekend', 'harbourfront',
] as const

const HEADLINES_STRONG_KW = [
  'prime minister', 'premier', 'doug ford', 'mark carney', 'olivia chow', 'mayor',
  'city hall', 'city council', 'queen s park', 'parliament', 'ottawa', 'police',
  'tps', 'opp', 'shooting', 'stabbing', 'homicide', 'arrested', 'charged',
  'suspect', 'investigation', 'court', 'supreme court', 'hospital', 'healthcare',
  'ukraine', 'ukrainian', 'russia', 'russian', 'zelenskyy', 'putin', 'nato',
  'moscow', 'kyiv', 'trump', 'white house', 'foreign affairs', 'security framework',
] as const

function scoreClientArticleSlots(title: string, summary: string, meta = ''): Record<string, number> {
  const titlePad = padNormalizedWords(title)
  const summaryPad = padNormalizedWords(summary)
  const metaPad = padNormalizedWords(meta)

  const scoreWith = (strong: readonly string[], medium: readonly string[] = []) =>
    countWholeKeywordHits(titlePad, strong) * 5 +
    countWholeKeywordHits(summaryPad, strong) * 2 +
    countWholeKeywordHits(metaPad, strong) * 3 +
    countWholeKeywordHits(titlePad, medium) * 3 +
    countWholeKeywordHits(summaryPad, medium) * 1

  const scores: Record<string, number> = {
    'Traffic & Weather': scoreWith(TRAFFIC_STRONG_KW, TRAFFIC_MEDIUM_KW),
    'Business News': scoreWith(BUSINESS_STRONG_KW, BUSINESS_MEDIUM_KW),
    'Sports & Culture': scoreWith(SPORTS_STRONG_KW, SPORTS_MEDIUM_KW),
    'Top Headlines': scoreWith(HEADLINES_STRONG_KW) + 1,
  }

  // Prevent war, geopolitics, or violent crime stories from ever entering Traffic & Weather
  if (
    countWholeKeywordHits(titlePad, [
      'ukraine', 'ukrainian', 'russia', 'russian', 'zelenskyy', 'putin', 'nato',
      'homicide', 'shooting', 'stabbing', 'murder', 'parliament',
    ]) > 0
  ) {
    scores['Traffic & Weather'] -= 15
  }

  return scores
}

export type RadioNewsTopic = {
  id: 'TRAFFIC' | 'WEATHER' | 'CRIME' | 'WORLD' | 'GTA' | 'BUSINESS' | 'SPORTS' | 'CULTURE'
  labelEn: string
  labelZh: string
}

export function classifyArticleTopic(a: Pick<RadioLiveArticle, 'title' | 'summary' | 'category' | 'link'>): RadioNewsTopic {
  const pad = padNormalizedWords(`${a.title} ${a.summary}`)
  if (
    countWholeKeywordHits(pad, [
      'weather', 'forecast', 'temperature', 'celsius', 'snow', 'snowfall', 'rain', 'rainfall',
      'storm', 'thunderstorm', 'wind', 'gusts', 'overcast', 'environment canada', 'heat warning', 'blizzard',
    ]) >= 2
  ) {
    return { id: 'WEATHER', labelEn: 'Weather & Climate', labelZh: '气象与环境' }
  }
  if (
    a.category === 'Traffic & Weather' ||
    countWholeKeywordHits(pad, [
      'traffic', 'ttc', 'subway', 'metrolinx', 'go transit', 'gardiner', 'dvp', 'highway',
      '401', 'commute', 'lane closure', 'ground stop', 'flights', 'air traffic', 'airport', 'faa', 'stoppage',
    ]) >= 1
  ) {
    return { id: 'TRAFFIC', labelEn: 'Traffic & Transit', labelZh: '交通与出行' }
  }
  if (a.category === 'Business News') {
    return { id: 'BUSINESS', labelEn: 'Economy & Markets', labelZh: '财经与楼市' }
  }
  if (a.category === 'Sports & Culture') {
    if (
      countWholeKeywordHits(pad, [
        'maple leafs', 'blue jays', 'raptors', 'argonauts', 'tfc', 'nhl', 'nba', 'mlb', 'nfl',
        'hockey', 'baseball', 'basketball', 'soccer', 'playoff', 'playoffs', 'game', 'coach', 'athlete', 'tournament',
      ]) >= 1
    ) {
      return { id: 'SPORTS', labelEn: 'Pro Sports', labelZh: '体育赛事' }
    }
    return { id: 'CULTURE', labelEn: 'Culture & Lifestyle', labelZh: '文娱与生活' }
  }
  if (
    countWholeKeywordHits(pad, [
      'police', 'tps', 'opp', 'shooting', 'stabbing', 'homicide', 'murder', 'suspect',
      'arrested', 'charged', 'investigation', 'collision', 'crash', 'court', 'trial', 'robbery',
    ]) >= 1
  ) {
    return { id: 'CRIME', labelEn: 'Crime & Justice', labelZh: '治安与司法' }
  }
  if (
    countWholeKeywordHits(pad, [
      'ukraine', 'ukrainian', 'russia', 'russian', 'zelenskyy', 'putin', 'nato', 'moscow',
      'kyiv', 'trump', 'white house', 'united states', 'europe', 'european', 'prime minister', 'ottawa', 'parliament',
    ]) >= 1
  ) {
    return { id: 'WORLD', labelEn: 'Canada & World', labelZh: '加国与国际' }
  }
  return { id: 'GTA', labelEn: 'GTA & Municipal', labelZh: '多伦多民生' }
}

function classifyClientArticle(title: string, summary: string, fallbackSlot = 'Top Headlines', meta = ''): string {
  const scores = scoreClientArticleSlots(title, summary, meta)
  let bestSlot = fallbackSlot || 'Top Headlines'
  let bestScore = scores[bestSlot] ?? 1
  for (const slot of ['Traffic & Weather', 'Business News', 'Sports & Culture'] as const) {
    if (scores[slot] > bestScore && scores[slot] >= 2) {
      bestScore = scores[slot]
      bestSlot = slot
    }
  }
  return bestSlot
}

function partitionClientArticlesBySlot(allArticles: RadioLiveArticle[]): Record<string, RadioLiveArticle[]> {
  const slots = ['Traffic & Weather', 'Top Headlines', 'Business News', 'Sports & Culture'] as const
  const bySlot: Record<string, RadioLiveArticle[]> = {
    'Traffic & Weather': [],
    'Top Headlines': [],
    'Business News': [],
    'Sports & Culture': [],
  }

  for (const art of allArticles) {
    const slot = classifyClientArticle(art.title, art.summary, 'Top Headlines', art.link)
    art.category = slot
    bySlot[slot].push(art)
  }

  // Sort each slot's articles so the highest-relevance article leads the broadcast slot
  for (const slot of slots) {
    bySlot[slot].sort(
      (a, b) =>
        scoreClientArticleSlots(b.title, b.summary, b.link)[slot] -
        scoreClientArticleSlots(a.title, a.summary, a.link)[slot],
    )
  }

  // Rebalance empty slots using the best-matching candidate (never forcing geopolitical/crime into Traffic & Weather)
  for (const slot of slots) {
    if (bySlot[slot].length > 0) continue
    let donor = ''
    let maxLen = 1
    for (const candidate of slots) {
      if (bySlot[candidate].length > maxLen) {
        maxLen = bySlot[candidate].length
        donor = candidate
      }
    }
    if (donor) {
      let bestIdx = -1
      let bestScore = -999
      for (let i = 0; i < bySlot[donor].length; i++) {
        if (i === 0 && bySlot[donor].length > 1) continue
        const sc = scoreClientArticleSlots(bySlot[donor][i].title, bySlot[donor][i].summary, bySlot[donor][i].link)[slot]
        if (sc > bestScore) {
          bestScore = sc
          bestIdx = i
        }
      }
      if (slot === 'Traffic & Weather' && bestScore < 0) continue
      if (bestIdx >= 0) {
        const [moved] = bySlot[donor].splice(bestIdx, 1)
        if (moved) {
          moved.category = slot
          bySlot[slot].push(moved)
        }
      }
    }
  }
  return bySlot
}

export function getCachedLiveRadioBulletin(): RadioBulletin | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RADIO_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RadioBulletin
    if (parsed && Array.isArray(parsed.segments) && parsed.segments.length > 0) {
      return parsed
    }
  } catch {
    // ignore storage errors
  }
  return null
}

function saveCachedLiveRadioBulletin(bulletin: RadioBulletin): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RADIO_CACHE_KEY, JSON.stringify(bulletin))
  } catch {
    // ignore storage errors
  }
}

export async function fetchLiveRadioBulletin(
  forceRefresh = false,
  onPartial?: (bulletin: RadioBulletin) => void,
): Promise<RadioBulletin | null> {
  const richWeatherPromise = fetchRichTorontoWeather()
  try {
    const endpoint = forceRefresh ? '/api/radio/news/refresh' : '/api/radio/news'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)
    const resp = await fetch(endpoint, {
      method: forceRefresh ? 'POST' : 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    if (resp.ok) {
      const data = (await resp.json()) as RadioBulletin
      if (data && Array.isArray(data.segments) && data.segments.length > 0 && data.isLive) {
        const existingCityNews = dedupeArticles(
          (Array.isArray(data.liveArticles) ? data.liveArticles : []).filter(isCityNewsArticle),
        )
        if (existingCityNews.length >= 4) {
          const richWeather = await richWeatherPromise
          if (richWeather) {
            data.weather = richWeather
          }
          const bySlot = partitionClientArticlesBySlot(existingCityNews)
          data.liveArticles = existingCityNews
          data.segments = buildSegmentsFromSlotMap(bySlot, data.weather)
          saveCachedLiveRadioBulletin(data)
          return data
        }
      }
    }
  } catch {
    // Fall through to direct browser live fetch
  }
  const bulletin = await fetchBrowserLiveBulletin(onPartial, richWeatherPromise)
  if (bulletin) {
    saveCachedLiveRadioBulletin(bulletin)
  }
  return bulletin
}

function degToCompassAbbr(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.max(0, Math.floor((deg + 22.5) / 45) % 8)]
}

function formatHour12(isoTime: string): string {
  const m = isoTime.match(/T(\d{2}):/)
  const h = m ? parseInt(m[1], 10) : new Date(isoTime).getHours()
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h > 12 ? `${h - 12}pm` : `${h}am`
}

function formatClockAmPm(isoTime?: string, fallback = '7:10AM'): string {
  if (!isoTime) return fallback
  const m = isoTime.match(/T(\d{2}):(\d{2})/)
  if (!m) return fallback
  const h = parseInt(m[1], 10)
  const mins = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mins}${ampm}`
}

export async function fetchRichTorontoWeather(): Promise<RadioLiveWeather | undefined> {
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&past_days=1&forecast_days=2&timezone=America%2FToronto',
    )
    if (!r.ok) return undefined
    const d = (await r.json()) as {
      current?: {
        time: string
        temperature_2m: number
        apparent_temperature: number
        relative_humidity_2m?: number
        precipitation?: number
        weather_code: number
        surface_pressure?: number
        wind_speed_10m: number
        wind_direction_10m: number
        wind_gusts_10m: number
        cloud_cover?: number
        visibility?: number
      }
      hourly?: {
        time: string[]
        temperature_2m: number[]
        apparent_temperature: number[]
        precipitation_probability: number[]
        weather_code: number[]
      }
      daily?: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        sunrise: string[]
        sunset: string[]
      }
    }
    if (!d.current) return undefined
    const cond = describeWmoCode(d.current.weather_code)
    const curHourPrefix = d.current.time.slice(0, 13)
    const hTimes = d.hourly?.time ?? []
    let startIdx = hTimes.findIndex((t) => t.startsWith(curHourPrefix))
    if (startIdx < 0) startIdx = 24

    const hourly: RadioHourlyForecastItem[] = []
    for (let i = startIdx; i < Math.min(hTimes.length, startIdx + 5); i++) {
      hourly.push({
        timeLabel: formatHour12(hTimes[i]),
        tempC: Math.round(d.hourly?.temperature_2m?.[i] ?? d.current.temperature_2m),
        feelsLikeC: Math.round(d.hourly?.apparent_temperature?.[i] ?? d.current.apparent_temperature),
        precipProbPct: Math.round(d.hourly?.precipitation_probability?.[i] ?? 10),
        weatherCode: d.hourly?.weather_code?.[i] ?? d.current.weather_code,
      })
    }

    const next3Probs = hourly.slice(0, 3).map((h) => h.precipProbPct)
    const maxNext3Prob = next3Probs.length > 0 ? Math.max(...next3Probs) : 0
    const isRainingNow = (d.current.precipitation ?? 0) > 0 || d.current.weather_code >= 51
    const precipAlertEn = isRainingNow
      ? 'Light precipitation currently moving across the GTA'
      : maxNext3Prob >= 35
        ? `Precipitation possible within the next 3 hours (${maxNext3Prob}% chance)`
        : 'No significant precipitation expected within the next 3 hours'
    const precipAlertZh = isRainingNow
      ? '大多伦多地区当前有降水云系经过'
      : maxNext3Prob >= 35
        ? `未来 3 小时内可能出现降水（概率 ${maxNext3Prob}%）`
        : '未来 3 小时内预计无明显降水'

    const windHintEn =
      d.current.wind_gusts_10m >= 30 || d.current.wind_speed_10m >= 20
        ? 'Windy.'
        : 'Light to moderate breeze.'
    const windHintZh =
      d.current.wind_gusts_10m >= 30 || d.current.wind_speed_10m >= 20
        ? '伴有明显阵风。'
        : '风力轻缓。'

    const hourlySummaryEn = `${cond.en} with clear breaks developing later today. ${windHintEn}`
    const hourlySummaryZh = `今日${cond.zh}，稍晚云层渐开。${windHintZh}`

    const todayIdx = (d.daily?.time?.length ?? 0) >= 2 ? 1 : 0
    const yestIdx = 0
    const yestDateStr = d.daily?.time?.[yestIdx]
    const yesterdayLabel = yestDateStr
      ? new Date(`${yestDateStr}T12:00:00`).toLocaleDateString('en-CA', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'Yesterday'

    const humidity = Math.round(d.current.relative_humidity_2m ?? 61)
    const pressureKpa = d.current.surface_pressure
      ? Math.round((d.current.surface_pressure / 10) * 10) / 10
      : 101.3
    const visibilityKm = d.current.visibility
      ? Math.max(1, Math.round(d.current.visibility / 1000))
      : 24
    const ceilingM = Math.max(600, Math.round(((100 - humidity) * 87) / 100) * 100)

    return {
      temperatureC: d.current.temperature_2m,
      feelsLikeC: d.current.apparent_temperature,
      windSpeedKmh: d.current.wind_speed_10m,
      windGustsKmh: d.current.wind_gusts_10m,
      windDirection: degToCardinal(d.current.wind_direction_10m),
      windCompass: degToCompassAbbr(d.current.wind_direction_10m),
      condition: cond.en,
      conditionZh: cond.zh,
      observedAt: d.current.time,
      weatherCode: d.current.weather_code,
      highC: Math.round(d.daily?.temperature_2m_max?.[todayIdx] ?? d.current.temperature_2m + 1),
      lowC: Math.round(d.daily?.temperature_2m_min?.[todayIdx] ?? d.current.temperature_2m - 4),
      yesterdayHighC: Math.round(d.daily?.temperature_2m_max?.[yestIdx] ?? d.current.temperature_2m - 1),
      yesterdayLowC: Math.round(d.daily?.temperature_2m_min?.[yestIdx] ?? d.current.temperature_2m - 5),
      yesterdayLabel,
      sunrise: formatClockAmPm(d.daily?.sunrise?.[todayIdx], '7:10AM'),
      sunset: formatClockAmPm(d.daily?.sunset?.[todayIdx], '4:53PM'),
      pressureKpa,
      humidityPct: humidity,
      visibilityKm,
      ceilingM,
      precipAlertEn,
      precipAlertZh,
      hourlySummaryEn,
      hourlySummaryZh,
      hourly,
    }
  } catch {
    return undefined
  }
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

function truncateCleanSentence(raw: string, maxLen = 320): string {
  const s = raw.replace(/\s*\.\.\.\s*$/, '').trim()
  if (!s) return ''
  if (s.length <= maxLen) {
    return /[.!?]$/.test(s) ? s : `${s}.`
  }
  const cut = s.slice(0, maxLen)
  const lastSentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('.'))
  if (lastSentenceEnd >= 60) {
    return cut.slice(0, lastSentenceEnd + 1).trim()
  }
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > 0) {
    return `${cut.slice(0, lastSpace).replace(/[,;:\-–—]+$/, '').trim()}.`
  }
  return `${cut}.`
}

function cleanBroadcastPair(title: string, summary: string): string {
  const t = title.trim()
  let s = summary.trim()
  if (t && s && s.toLowerCase().startsWith(t.toLowerCase())) {
    s = s.slice(t.length).replace(/^[.:;\-–—\s]+/, '').trim()
  }
  const tPunct = t && !/[.!?]$/.test(t) ? `${t}.` : t
  if (!s || s.toLowerCase() === t.toLowerCase()) return tPunct
  const sPunct = !/[.!?]$/.test(s) ? `${s}.` : s
  return `${tPunct} ${sPunct}`
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
      const xmlCats = Array.from(node.querySelectorAll('category'))
        .map((c) => c.textContent ?? '')
        .join(' ')
      const rawDesc = node.querySelector('description')?.textContent ?? ''
      const encodedNode =
        node.getElementsByTagNameNS('*', 'encoded')[0] ?? node.getElementsByTagName('content:encoded')[0]
      const rawEncoded = encodedNode?.textContent ?? ''
      let summary = stripHtml(rawDesc)
        .replace(/The post .*? appeared first on CityNews.*$/i, '')
        .trim()
      if (summary.length < 80 && rawEncoded) {
        const full = stripHtml(rawEncoded)
          .replace(/The post .*? appeared first on CityNews.*$/i, '')
          .trim()
        if (full.length > summary.length) {
          summary = full
        }
      }
      summary = truncateCleanSentence(summary, 320)
      out.push({
        title,
        titleZh: '',
        summary,
        link,
        source,
        category: classifyClientArticle(title, summary, fallbackSlot, `${link} ${xmlCats}`),
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
  const fromRss2Json = async (): Promise<RadioLiveArticle[]> => {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(f.url)}`)
    if (!res.ok) throw new Error('rss2json failed')
    const data = (await res.json()) as {
      items?: {
        title?: string
        description?: string
        content?: string
        link?: string
        pubDate?: string
        categories?: string[]
      }[]
    }
    const items = (data.items ?? []).map((it) => {
      const title = stripHtml(it.title ?? '')
      let rawDesc = stripHtml(it.description ?? '')
        .replace(/The post .*? appeared first on CityNews.*$/i, '')
        .trim()
      if (rawDesc.length < 80 && it.content) {
        rawDesc = stripHtml(it.content)
          .replace(/The post .*? appeared first on CityNews.*$/i, '')
          .trim()
      }
      const summary = truncateCleanSentence(rawDesc, 320)
      const meta = `${it.link ?? ''} ${(it.categories ?? []).join(' ')}`
      return {
        title,
        titleZh: '',
        summary,
        link: it.link ?? '',
        source: f.source,
        category: classifyClientArticle(title, summary, f.slot, meta),
        publishedAt: it.pubDate ?? new Date().toISOString(),
      } satisfies RadioLiveArticle
    })
    if (items.length === 0) throw new Error('empty rss2json')
    return items
  }

  const fromAllOriginsXml = async (): Promise<RadioLiveArticle[]> => {
    const xmlRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(f.url)}`)
    if (!xmlRes.ok) throw new Error('allorigins failed')
    const xmlText = await xmlRes.text()
    const parsed = parseRssXmlItems(xmlText, f.source, f.slot)
    if (parsed.length === 0) throw new Error('empty xml')
    return parsed
  }

  try {
    return await Promise.any([fromRss2Json(), fromAllOriginsXml()])
  } catch {
    return []
  }
}

function buildSegmentsFromSlotMap(
  bySlot: Record<string, RadioLiveArticle[]>,
  weather: RadioLiveWeather | undefined,
): RadioNewsWheelSegment[] {
  const base = STATION_680_NEWS.wheelSegments
  return base.map((fb, idx) => {
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
        top
          ? cleanBroadcastPair(top.title, top.summary)
          : 'In the 680 News airborne traffic centre, major commuter corridors across the Gardiner Expressway, the Don Valley Parkway, and Highway 401 are being monitored closely for rush-hour volume and arterial slowdowns.',
      ]
      const text = lines.join(' ')
      const liveLex = extractLiveKeyLexis(text)
      const liveLiaisons = extractLiveLiaisons(text)
      return {
        ...fb,
        title,
        titleZh: top?.titleZh
          ? `680 实时 (${temp}°C ${condZh})：${top.titleZh}`
          : `680 实时路况与气象：多伦多当前 ${temp}°C ${condZh}（体感 ${feels}°C）`,
        text,
        textZh: top?.summaryZh
          ? `这里是 680 News 路况与天气连播。多伦多皮尔逊国际机场及市中心当前${condZh}，气温 ${temp}°C（体感 ${feels}°C），阵风达 ${gust} km/h。${top.titleZh ? `${top.titleZh}：` : ''}${top.summaryZh}`
          : `这里是 680 News 路况与天气连播。多伦多皮尔逊国际机场及市中心当前${condZh}，气温 ${temp}°C（体感 ${feels}°C），阵风达 ${gust} km/h。680 空中交通中心正在密切监测嘉甸拿高速（Gardiner Expressway）、当河谷大道（DVP）及 401 号高速等主干道的通勤车流与缓慢路段。`,
        publishedAt: top?.publishedAt ?? new Date().toISOString(),
        sourceUrl: top?.link ?? 'https://toronto.citynews.ca/traffic/',
        sourceName: top?.source ?? 'CityNews 680 Traffic & Weather',
        keyLexis: liveLex.length > 0 ? liveLex : fb.keyLexis,
        liaisons: liveLiaisons.length > 0 ? liveLiaisons : fb.liaisons,
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
      cleanBroadcastPair(top.title, top.summary),
      'Stay tuned to 680 NewsRadio Toronto for continuous live coverage.',
    ].join(' ')
    const liveLex = extractLiveKeyLexis(text)
    const liveLiaisons = extractLiveLiaisons(text)
    return {
      ...fb,
      title: top.title,
      titleZh: top.titleZh || top.title,
      text,
      textZh: top.summaryZh ? `${top.titleZh ? `${top.titleZh}。` : ''}${top.summaryZh}` : fb.textZh,
      publishedAt: top.publishedAt,
      sourceUrl: top.link,
      sourceName: top.source,
      keyLexis: liveLex.length > 0 ? liveLex : fb.keyLexis,
      liaisons: liveLiaisons.length > 0 ? liveLiaisons : fb.liaisons,
      relatedArticles: list,
    }
  })
}

async function translateArticlesAndSegments(
  articles: RadioLiveArticle[],
  segments: RadioNewsWheelSegment[],
): Promise<void> {
  await Promise.all([
    ...articles.map(async (art) => {
      const [tZh, sZh] = await Promise.all([
        translateEnToZh(art.title),
        art.summary ? translateEnToZh(art.summary) : Promise.resolve(''),
      ])
      if (tZh) art.titleZh = tZh
      if (sZh) art.summaryZh = sZh
    }),
    ...segments.map(async (seg) => {
      const [tZh, textZh] = await Promise.all([
        translateEnToZh(seg.title),
        translateEnToZh(seg.text),
      ])
      if (tZh) seg.titleZh = tZh
      if (textZh) seg.textZh = textZh
    }),
  ])
}

async function fetchBrowserLiveBulletin(
  onPartial?: (bulletin: RadioBulletin) => void,
  existingWeatherPromise?: Promise<RadioLiveWeather | undefined>,
): Promise<RadioBulletin | null> {
  try {
    const weatherPromise = existingWeatherPromise ?? fetchRichTorontoWeather()

    const feeds = [
      { url: 'https://toronto.citynews.ca/feed/', source: 'CityNews 680 Toronto', slot: 'Top Headlines' },
    ]

    const [weather, ...feedLists] = await Promise.all([
      weatherPromise,
      ...feeds.map((f) => fetchFeedArticlesInBrowser(f)),
    ])
    const allArticles = dedupeArticles(feedLists.flat())

    if (!weather && allArticles.length === 0) return null

    const bySlot = partitionClientArticlesBySlot(allArticles)
    const segments = buildSegmentsFromSlotMap(bySlot, weather)

    // Emit immediate English live bulletin before waiting for translation
    if (onPartial) {
      onPartial({
        updatedAt: new Date().toISOString(),
        source: 'CityNews 680 Toronto (toronto.citynews.ca/feed/)',
        isLive: true,
        weather,
        segments: segments.map((s) => ({ ...s })),
        liveArticles: allArticles.map((a) => ({ ...a })),
      })
    }

    await translateArticlesAndSegments(allArticles, segments)

    return {
      updatedAt: new Date().toISOString(),
      source: 'CityNews 680 Toronto (toronto.citynews.ca/feed/)',
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
