import { BUILTIN_VOCAB_CARDS } from '@/lib/vocab-builtin'
import type { EnglishCard } from '@/lib/english'

export type MiniDictionaryEntry = {
  id?: string
  word: string
  ipa: string
  band: string
  pos: string
  contextNote?: string
  meaningZh: string
  meaningEn?: string
  examParaphrase?: string
  synonyms?: string[]
}

/** Pre-curated high-yield IELTS dictionary data matching official test points */
const IELTS_DICTIONARY: Record<string, MiniDictionaryEntry> = {
  complimentary: {
    id: 'seed-complimentary',
    word: 'complimentary',
    ipa: "/,kɒm.plɪ'men.tər.i/",
    band: 'Band 8.0',
    pos: 'adj.',
    contextNote: '健身中心权限的关键对话',
    meaningZh: '免费赠送的；赞美的 (given free of charge)',
    meaningEn: 'given free of charge; praising or admiring',
    examParaphrase: 'complimentary = free = at no extra cost',
    synonyms: ['free', 'at no extra cost', 'gratis', 'included'],
  },
  additional: {
    id: 'seed-additional',
    word: 'additional',
    ipa: "/ə'dɪʃ.ən.əl/",
    band: 'Band 6.5',
    pos: 'adj.',
    contextNote: '额外附加资源与资金支持',
    meaningZh: '额外的；附加的 (extra to what already exists)',
    meaningEn: 'extra to what already exists',
    examParaphrase: 'additional = extra = further = supplemental',
    synonyms: ['extra', 'supplemental', 'further', 'added'],
  },
  abandon: {
    id: 'seed-abandon',
    word: 'abandon',
    ipa: "/ə'bæn.dən/",
    band: 'Band 7.0',
    pos: 'v.',
    contextNote: '政策放弃与方案中止',
    meaningZh: '放弃；舍弃；中途改变 (leave or cease)',
    meaningEn: 'to cease to support or look after',
    examParaphrase: 'abandon = discard = drop = relinquish',
    synonyms: ['discard', 'relinquish', 'drop'],
  },
  clog: {
    id: 'seed-clog',
    word: 'clog',
    ipa: '/klɒɡ/',
    band: 'Band 6.5',
    pos: 'v.',
    contextNote: '管道受阻与交通拥堵',
    meaningZh: '堵塞，阻塞；阻碍；木屐 (block or become blocked)',
    meaningEn: 'to block or become blocked with an accumulation of something',
    examParaphrase: 'clog = obstruct = congest = choke',
    synonyms: ['obstruct', 'congest', 'choke', 'blockade'],
  },
  apprentice: {
    word: 'apprentice',
    ipa: '/əˈprentɪs/',
    band: 'Band 7.0',
    pos: 'n.',
    contextNote: '企业新晋学徒入职培训',
    meaningZh: '学徒；见习生 (a person learning a trade)',
    meaningEn: 'a person learning a trade from a skilled employer',
    examParaphrase: 'apprentice = trainee = learner = cadet',
    synonyms: ['trainee', 'learner', 'intern'],
  },
  probationary: {
    word: 'probationary',
    ipa: '/prəˈbeɪʃənəri/',
    band: 'Band 7.5',
    pos: 'adj.',
    contextNote: '企业试用期休假制度限制',
    meaningZh: '试用的；实习期的 (concerning a trial period)',
    meaningEn: 'relating to a process of testing or trial',
    examParaphrase: 'probationary period = trial period = initial trial',
    synonyms: ['trial', 'introductory', 'provisional'],
  },
  physiotherapist: {
    word: 'physiotherapist',
    ipa: '/ˌfɪziəʊˈθerəpɪst/',
    band: 'Band 7.5',
    pos: 'n.',
    contextNote: '门诊预约专业运动理疗师',
    meaningZh: '物理治疗师；理疗专家',
    meaningEn: 'a person qualified to treat injury or deformity with physical methods',
    examParaphrase: 'physiotherapist = PT = physical therapist',
    synonyms: ['physical therapist', 'therapist'],
  },
  overwhelmed: {
    word: 'overwhelmed',
    ipa: '/ˌəʊvəˈwelmd/',
    band: 'Band 7.0',
    pos: 'adj.',
    contextNote: '入职首周面对大量信息的心理负荷',
    meaningZh: '不堪重负的；不知所措的',
    meaningEn: 'feeling buried beneath huge mass or excessive strain',
    examParaphrase: 'feel overwhelmed = under great pressure = inundated',
    synonyms: ['swamped', 'inundated', 'overloaded'],
  },
  deliberate: {
    word: 'deliberate',
    ipa: '/dɪˈlɪbərət/',
    band: 'Band 7.5',
    pos: 'adj.',
    contextNote: '有意识地跨部门沟通交流',
    meaningZh: '深思熟虑的；蓄意的；从容不迫的',
    meaningEn: 'done consciously and intentionally',
    examParaphrase: 'deliberate effort = intentional effort = conscious initiative',
    synonyms: ['intentional', 'conscious', 'purposeful'],
  },
  up: {
    word: 'up',
    ipa: '/ʌp/',
    band: 'Band 6.5',
    pos: 'adv./prep.',
    contextNote: '雅思考试高频方位与程度短语',
    meaningZh: '向上；多达；达到 (up to: 达到/多达)',
    meaningEn: 'towards a higher place; up to: indicating a maximum limit or degree',
    examParaphrase: 'up to fifteen degrees = reaching as high as 15°C',
    synonyms: ['upward', 'reaching', 'as much as', 'climbing'],
  },
  subterranean: {
    word: 'subterranean',
    ipa: '/ˌsʌb.təˈreɪ.ni.ən/',
    band: 'Band 8.0',
    pos: 'adj.',
    contextNote: '地表下建筑与地下蓄水降温系统',
    meaningZh: '地下的；地面下存在的 (underground)',
    meaningEn: 'existing, situated, or operating below the surface of the earth',
    examParaphrase: 'subterranean cooling = underground passive thermal regulation',
    synonyms: ['underground', 'subsurface', 'buried'],
  },
  cooling: {
    word: 'cooling',
    ipa: '/ˈkuːlɪŋ/',
    band: 'Band 6.5',
    pos: 'n./adj.',
    contextNote: '被动式建筑制冷技术',
    meaningZh: '冷却；降温；制冷的',
    meaningEn: 'the process of becoming cooler or falling in temperature',
    examParaphrase: 'cooling = temperature reduction = passive cooling',
    synonyms: ['chilling', 'refrigeration', 'temperature mitigation'],
  },
  qanat: {
    word: 'qanat',
    ipa: '/kəˈnɑːt/',
    band: 'Band 7.5',
    pos: 'n.',
    contextNote: '古代地下水渠与微气候调节网络',
    meaningZh: '坎儿井 (古代坡状地下引水与降温暗渠)',
    meaningEn: 'a gently sloping underground channel to transport mountain water without evaporation',
    examParaphrase: 'qanat = subterranean irrigation and cooling channel',
    synonyms: ['aqueduct', 'underground channel', 'water conduit'],
  },
  windcatcher: {
    word: 'windcatcher',
    ipa: '/ˈwɪndˌkætʃ.ər/',
    band: 'Band 7.5',
    pos: 'n.',
    contextNote: '传统被动自然通风塔 (波斯 badgir)',
    meaningZh: '风塔；捕风器 (利用气流温差对流引风建筑构件)',
    meaningEn: 'a traditional architectural element used to create natural ventilation in buildings',
    examParaphrase: 'windcatcher = badgir = natural ventilation chimney',
    synonyms: ['badgir', 'air tower', 'solar chimney'],
  },
  badgir: {
    word: 'badgir',
    ipa: '/bædˈɡɪər/',
    band: 'Band 7.5',
    pos: 'n.',
    contextNote: '伊朗传统捕风降温塔',
    meaningZh: '捕风塔；风楼 (传统中东被动降温构筑物)',
    meaningEn: 'traditional Persian windtower for passive cooling and circulation',
    examParaphrase: 'badgir = traditional Persian windcatcher',
    synonyms: ['windcatcher', 'ventilation tower'],
  },
  vernacular: {
    word: 'vernacular',
    ipa: '/vəˈnæk.jə.lər/',
    band: 'Band 8.0',
    pos: 'adj./n.',
    contextNote: '乡土建筑传统与因地制宜的设计',
    meaningZh: '乡土的；本地传统的；因地制宜的',
    meaningEn: 'concerned with domestic and indigenous buildings rather than monumental ones',
    examParaphrase: 'vernacular engineering = indigenous local building tradition',
    synonyms: ['indigenous', 'regional', 'native', 'local'],
  },
  convection: {
    word: 'convection',
    ipa: '/kənˈvek.ʃən/',
    band: 'Band 7.5',
    pos: 'n.',
    contextNote: '热力学流体温差传导机制',
    meaningZh: '对流 (流体受热膨胀上升引起的热量传递)',
    meaningEn: 'movement caused within a fluid by the tendency of hotter material to rise',
    examParaphrase: 'convection cooling = natural airflow heat transfer',
    synonyms: ['heat circulation', 'thermal transfer'],
  },
  buoyancy: {
    word: 'buoyancy',
    ipa: '/ˈbɔɪ.ən.si/',
    band: 'Band 7.5',
    pos: 'n.',
    contextNote: '浮力驱动的自然通风模式',
    meaningZh: '浮力；向上浮动的力量 (烟囱效应驱动力)',
    meaningEn: 'the ability or tendency of something to float in water or other fluid',
    examParaphrase: 'buoyancy-driven = thermal stack effect driven',
    synonyms: ['uplift', 'updraft force', 'floating tendency'],
  },
  swelling: {
    word: 'swelling',
    ipa: '/ˈswelɪŋ/',
    band: 'Band 6.5',
    pos: 'n.',
    contextNote: '膝关节运动损伤局部水肿体征',
    meaningZh: '肿胀；隆起部；水肿',
    meaningEn: 'an abnormal enlargement of a body part',
    examParaphrase: 'swelling = edema = enlargement = inflamed area',
    synonyms: ['puffiness', 'inflammation', 'enlargement'],
  },
  dilapidated: {
    word: 'dilapidated',
    ipa: '/dɪˈlæpɪdeɪtɪd/',
    band: 'Band 8.0',
    pos: 'adj.',
    contextNote: '古建筑风化与修缮保护论述',
    meaningZh: '破旧的；荒废的；年久失修的',
    meaningEn: 'in a state of disrepair or ruin as a result of age or neglect',
    examParaphrase: 'dilapidated = run-down = decaying = crumbling',
    synonyms: ['run-down', 'ramshackle', 'decaying'],
  },
}

function cleanLookupWord(raw: string): string {
  return raw.replace(/^[^\w]+|[^\w]+$/g, '').trim().toLowerCase()
}

/** Retrieve dictionary data for a word, falling back to card database or heuristic synthesis */
export function getDictionaryEntry(
  rawWord: string,
  existingCards: EnglishCard[] = [],
  contextSentence = '',
): MiniDictionaryEntry {
  const word = cleanLookupWord(rawWord)
  if (!word) {
    return {
      word: rawWord,
      ipa: `/${rawWord}/`,
      band: 'Band 6.5',
      pos: 'n.',
      meaningZh: '暂无词义释义',
    }
  }

  // 1. Direct hit in pre-curated IELTS dictionary
  if (IELTS_DICTIONARY[word]) {
    const entry = { ...IELTS_DICTIONARY[word] }
    const matchedCard = existingCards.find((c) => c.word.toLowerCase() === word)
    if (matchedCard) {
      entry.id = matchedCard.id
    }
    return entry
  }

  // 2. Direct hit in user cards / builtin database
  const card =
    existingCards.find((c) => c.word.toLowerCase() === word) ??
    BUILTIN_VOCAB_CARDS.find((c) => c.word.toLowerCase() === word)

  if (card) {
    const firstSense = card.senses?.[0]
    const pos = firstSense?.pos ?? 'lexis'
    const cleanMeaningZh = firstSense?.zh || card.meaning
    const examParaphrase =
      card.band?.paraphrases && card.band.paraphrases.length > 0
        ? `${card.word} = ${card.band.paraphrases.slice(0, 3).join(' = ')}`
        : card.band?.collocations?.[0]
          ? `高频搭配：${card.band.collocations[0]}`
          : undefined

    return {
      id: card.id,
      word: card.word,
      ipa: card.pronunciation || `/${card.word}/`,
      band: card.word.length >= 8 ? 'Band 7.5' : card.word.length >= 6 ? 'Band 7.0' : 'Band 6.5',
      pos,
      contextNote: card.band?.writingZh?.slice(0, 18) ?? '雅思核心高频词',
      meaningZh: cleanMeaningZh,
      meaningEn: firstSense?.en,
      examParaphrase,
      synonyms: card.band?.paraphrases,
    }
  }

  // 3. Fallback heuristic generation for any arbitrary English word
  const length = word.length
  const band = length >= 10 ? 'Band 8.0' : length >= 8 ? 'Band 7.5' : length >= 6 ? 'Band 7.0' : 'Band 6.0'
  const isAdjective = word.endsWith('ive') || word.endsWith('ary') || word.endsWith('ic') || word.endsWith('al') || word.endsWith('ous') || word.endsWith('able')
  const isAdverb = word.endsWith('ly')
  const isVerb = word.endsWith('ate') || word.endsWith('ize') || word.endsWith('ise') || word.endsWith('ed') || word.endsWith('ing')
  const pos = isAdverb ? 'adv.' : isAdjective ? 'adj.' : isVerb ? 'v.' : 'n.'

  return {
    word,
    ipa: `/${word}/`,
    band,
    pos,
    contextNote: contextSentence ? '当前语境重点释义' : '雅思考试真题核心词汇',
    meaningZh: `雅思学术词汇 · ${pos}`,
    examParaphrase: `${word} (核心考点词)`,
  }
}
