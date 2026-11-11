import { LEXICON_GLOSS } from '@/lib/lexicon-data'

/**
 * High-precision Chinese translations for IELTS Academic collocations and lexical chunks.
 */
const EXACT_COLLOCATIONS_ZH: Record<string, string> = {
  // additional collocations & synonyms
  'additional cost': '额外成本 / 额外费用',
  'additional support': '额外支持 / 援助支持',
  'additional resources': '补充资源 / 额外资源',
  'additional information': '附加信息 / 补充说明',
  'additional burden': '额外负担 / 加重负担',
  'additional funding': '追加资金 / 额外拨款',
  'additional expense': '额外开支 / 附加费用',
  'additional charge': '额外收费 / 附加费',
  'additional time': '额外时间 / 宽限时间',
  'additional assistance': '额外援助 / 协助支持',
  'additional benefit': '额外福利 / 附加收益',
  'additional measure': '追加举措 / 补充措施',
  'additional pressure': '额外压力 / 叠加压力',

  // synonym variations (extra, further, supplementary, added)
  'extra cost': '额外费用 / 额外成本',
  'extra support': '额外支持 / 辅助支援',
  'extra resources': '额外资源 / 补充资源',
  'extra information': '额外信息 / 补充说明',
  'extra burden': '额外负担 / 沉重负担',
  'extra funding': '额外资助 / 额外资金',
  'extra charge': '额外收费 / 附加费用',
  'extra time': '额外时间 / 加时',
  'extra effort': '额外付出 / 加倍努力',

  'further support': '进一步支持 / 后续援助',
  'further resources': '进一步资源 / 后续资源',
  'further information': '进一步信息 / 详细情况',
  'further funding': '后续拨款 / 进一步资助',
  'further cost': '后续成本 / 额外支出',
  'further burden': '进一步负担 / 加深负担',
  'further development': '深入发展 / 进一步发展',
  'further investigation': '深入调查 / 进一步调查',
  'further research': '深入研究 / 进一步探讨',
  'further notice': '另行通知 / 进一步通告',

  'supplementary resources': '补充资源 / 配套资源',
  'supplementary support': '补充支持 / 辅助支援',
  'supplementary funding': '追加拨款 / 补充经费',
  'supplementary information': '补充信息 / 附录资料',
  'supplementary cost': '补充成本 / 追加开销',
  'supplementary burden': '附加负担 / 附带负担',
  'supplementary material': '补充材料 / 辅助资料',
  'supplementary income': '额外收入 / 副业收入',

  'supplemental resources': '补充资源 / 配套资源',
  'supplemental support': '补充支持 / 辅助支援',
  'supplemental funding': '追加拨款 / 补充经费',
  'supplemental information': '补充信息 / 附带信息',
  'supplemental cost': '附加成本',
  'supplemental burden': '附加负担',

  'added information': '附加信息 / 补充资料',
  'added cost': '附加成本 / 增加的费用',
  'added support': '增加的支持 / 额外援助',
  'added resources': '新增资源 / 补充资源',
  'added burden': '附加负担 / 新增负担',
  'added funding': '追加拨款 / 新增资金',
  'added value': '附加价值 / 增值',
  'added bonus': '额外奖励 / 额外福利',

  // complimentary
  'complimentary access': '免费使用权限 / 赠送入场',
  'complimentary breakfast': '免费早餐 / 附赠早餐',
  'complimentary ticket': '免费赠票 / 赠送门票',
  'complimentary shuttle': '免费穿梭巴士 / 接驳车',
  'complimentary drinks': '免费赠饮 / 附赠酒水',
  'complimentary remarks': '赞美之词 / 夸奖言辞',
  'complimentary wifi': '免费无线网络',
  'complimentary upgrade': '免费升级服务',

  // abandon / abandonment
  'abandon hope': '放弃希望 / 绝望',
  'abandon policy': '废除政策 / 放弃方针',
  'abandon project': '中止项目 / 放弃工程',
  'abandon vehicle': '遗弃车辆 / 弃车',
  'abandon plan': '放弃计划 / 改变计划',
  'abandon tradition': '摈弃传统 / 抛弃习俗',
  'widespread abandonment': '普遍废弃 / 大规模放弃',
  'sudden abandonment': '骤然中止 / 突然放弃',
  'project abandonment': '项目废止 / 工程弃置',
  'complete abandonment': '彻底废弃 / 完全放弃',
  'child abandonment': '遗弃儿童 / 弃婴',
  'policy abandonment': '政策废止 / 方针撤销',

  // abbey
  'historic abbey': '历史修道院',
  'medieval abbey': '中世纪修道院',
  'ancient abbey': '古代修道院',
  'abbey ruins': '修道院废墟 / 遗址',
  'royal abbey': '皇家大修道院',
  'abbey architecture': '修道院建筑艺术',

  // ability
  'cognitive ability': '认知能力 / 认知水平',
  'linguistic ability': '语言能力 / 语言天赋',
  'innate ability': '先天能力 / 固有天赋',
  'analytical ability': '分析能力 / 逻辑剖析能力',
  'academic ability': '学术能力 / 学习能力',
  'problem-solving ability': '解决问题的能力',

  // abnormal
  'abnormal weather': '异常天气 / 极端气候',
  'abnormal fluctuations': '异常波动 / 不寻常震荡',
  'abnormal behavior': '反常行为 / 异常举止',
  'abnormal readings': '异常读数 / 反常数值',
  'abnormal conditions': '异常状况 / 不正常条件',
  'abnormal temperature': '反常气温 / 异常温度',

  // aboard
  'welcome aboard': '欢迎登机/登船 / 欢迎加入',
  'passengers aboard': '在途乘客 / 机船载乘客',
  'crew aboard': '在岗机组/船员',
  'cargo aboard': '机船载货物',
  'remain aboard': '留在机舱/甲板上',
  'step aboard': '踏上机舱/登船',

  // abuse
  'power abuse': '滥用职权 / 权力滥用',
  'substance abuse': '药物滥用 / 物质依赖',
  'verbal abuse': '言语辱骂 / 恶语相向',
  'curb abuse': '遏制滥用 / 惩治虐待',
  'systemic abuse': '体制性弊端 / 系统性虐待',
  'abuse of authority': '滥用职权 / 越权滥用',

  // academy
  'military academy': '军事院校 / 军校',
  'prestigious academy': '声名显赫的学院 / 顶尖名校',
  'national academy': '国家科学院 / 综合研究院',
  'academy fellow': '科学院院士 / 学院特聘研究员',
  'art academy': '艺术学院 / 美术专修院',
  'academic society': '学术学会 / 研讨协会',

  // accelerate
  'accelerate growth': '加速增长 / 促进成长',
  'accelerate transition': '加速转型 / 推进过渡',
  'accelerate pace': '加快步伐 / 加快节奏',
  'accelerate decline': '加速下滑 / 衰退加剧',
  'accelerate progress': '加速进展 / 推进进程',
  'accelerate adoption': '加速普及 / 推进采纳',

  // accent
  'regional accent': '地方口音 / 区域方言',
  'slight accent': '轻微口音 / 稍带口音',
  'heavy accent': '浓重口音 / 浓厚乡音',
  'native accent': '本土口音 / 地道母语腔调',
  'accent diversity': '口音多样性',
  'distinctive accent': '独特口音 / 鲜明腔调',

  // accept
  'accept responsibility': '承担责任 / 勇于担责',
  'accept proposal': '接纳提议 / 同意方案',
  'widely accept': '普遍接受 / 广泛认可',
  'accept compromise': '接受妥协 / 达成和解',
  'accept challenge': '接受挑战 / 迎接考验',
  'accept offer': '接受录取 / 接受要约',

  // clog
  'clog the drain': '堵塞排水口 / 管道阻塞',
  'clog arterial roads': '堵塞主干道 / 造成主路拥堵',
  'clog waterways': '堵塞航道 / 水路淤塞',
  'clog up the system': '使系统瘫痪 / 造成运转拥堵',
  'clog pores': '堵塞毛孔',
}

/**
 * Common nouns frequently used in academic collocations.
 */
const NOUN_ZH: Record<string, string> = {
  cost: '成本 / 费用',
  costs: '成本 / 费用',
  support: '支持 / 援助',
  resources: '资源',
  resource: '资源',
  information: '信息 / 资料',
  burden: '负担',
  burdens: '负担',
  funding: '资金 / 拨款',
  funds: '资金',
  factor: '因素 / 要素',
  factors: '因素',
  role: '角色 / 作用',
  impact: '影响 / 冲击',
  evidence: '证据 / 依据',
  context: '语境 / 背景',
  drain: '下水道 / 排水口',
  roads: '主干道路',
  waterways: '水路航道',
  system: '系统运转',
  pores: '毛孔',
  growth: '增长 / 发展',
  transition: '转型 / 过渡',
  pace: '步伐 / 节奏',
  decline: '下降 / 衰退',
  progress: '进展 / 推进',
  adoption: '采纳 / 普及',
  responsibility: '责任 / 担责',
  proposal: '提案 / 建议',
  compromise: '妥协 / 达成一致',
  challenge: '挑战 / 考验',
  offer: '录用要约 / 录取',
  weather: '天气 / 气候',
  fluctuations: '波动 / 震荡',
  behavior: '行为 / 举止',
  readings: '读数 / 数值',
  conditions: '状况 / 条件',
  temperature: '温度 / 气温',
  hope: '希望',
  policy: '政策 / 方针',
  project: '项目 / 工程',
  vehicle: '车辆 / 交通工具',
  plan: '计划 / 方案',
  tradition: '传统 / 习俗',
  abandonment: '废弃 / 遗弃',
  ruins: '遗址 / 废墟',
  architecture: '建筑艺术',
  ability: '能力 / 天赋',
  passengers: '乘客',
  crew: '机组 / 船员',
  cargo: '货物',
  abuse: '滥用 / 虐待',
  authority: '职权 / 权威',
  academy: '学院 / 研究院',
  accent: '口音 / 腔调',
  diversity: '多样性',
}

/**
 * Common modifiers (adjectives/adverbs).
 */
const MODIFIER_ZH: Record<string, string> = {
  additional: '额外',
  extra: '额外',
  further: '进一步',
  supplementary: '补充',
  supplemental: '补充',
  added: '附加',
  complimentary: '免费 / 附赠',
  cognitive: '认知',
  linguistic: '语言',
  innate: '先天',
  analytical: '分析',
  academic: '学术',
  abnormal: '异常',
  military: '军事',
  prestigious: '著名',
  national: '国家',
  regional: '地方',
  slight: '轻微',
  heavy: '浓重',
  native: '本土',
  distinctive: '独特',
  historic: '历史',
  medieval: '中世纪',
  ancient: '古代',
  royal: '皇家',
  widespread: '广泛',
  sudden: '突然',
  complete: '彻底',
  verbal: '言语',
  systemic: '系统性',
  welcome: '欢迎',
  widely: '广泛',
}

/**
 * Sanitizes a single meaning entry (e.g. "额外的；附加的" -> "额外").
 */
function cleanHeadwordMeaning(meaning?: string): string {
  if (!meaning) return ''
  const first = meaning.split(/[；;，,、/]/)[0]?.trim() ?? ''
  return first
    .replace(/^(to\s+)/i, '')
    .replace(/(的|地)$/, '')
    .trim()
}

/**
 * Translates an academic collocation or phrase into authentic Chinese.
 * e.g.:
 *  - translateCollocation('additional cost') -> "额外成本 / 额外费用"
 *  - translateCollocation('extra cost') -> "额外费用 / 额外成本"
 *  - translateCollocation('further support') -> "进一步支持 / 后续援助"
 *  - translateCollocation('supplementary resources') -> "补充资源 / 配套资源"
 *  - translateCollocation('added information') -> "附加信息 / 补充资料"
 */
export function translateCollocation(phrase: string, headword?: string, headwordZh?: string): string {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized) return ''

  // 1. Exact match lookup
  if (EXACT_COLLOCATIONS_ZH[normalized]) {
    return EXACT_COLLOCATIONS_ZH[normalized]
  }

  // 2. Try decomposed two-word or multi-word phrase matching
  const words = normalized.split(' ')
  if (words.length === 2) {
    const [w1, w2] = words
    const modZh = MODIFIER_ZH[w1] || cleanHeadwordMeaning(headwordZh) || (LEXICON_GLOSS[w1] ? cleanHeadwordMeaning(LEXICON_GLOSS[w1]) : '')
    const nounZh = NOUN_ZH[w2] || (LEXICON_GLOSS[w2] ? cleanHeadwordMeaning(LEXICON_GLOSS[w2]) : '')

    if (modZh && nounZh) {
      // Check verb patterns like "abandon hope" -> "放弃希望"
      if (w1 === 'abandon') return `放弃${nounZh}`
      if (w1 === 'accelerate') return `加快${nounZh}`
      if (w1 === 'accept') return `接纳${nounZh}`
      if (w1 === 'clog') return `堵塞${nounZh}`

      // Standard modifier + noun (e.g. 额外成本)
      return `${modZh}${nounZh}`
    }
  }

  // 3. Fallback using headword & gloss context
  if (headword && headwordZh) {
    const cleaned = cleanHeadwordMeaning(headwordZh)
    if (cleaned) {
      return `${cleaned}搭配 · 高分学术语块`
    }
  }

  return '高分学术语块'
}
