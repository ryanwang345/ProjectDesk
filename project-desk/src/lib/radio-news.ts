export type RadioCategory = 'all' | 'community' | 'science' | 'world' | 'culture' | 'wellness'

export type RadioVocabularyItem = {
  word: string
  pos: string
  ipa: string
  meaning: string
  band: string
  contextSnippet: string
}

export type RadioSegment = {
  id: string
  startSecond: number
  endSecond: number
  speaker: string
  speakerRole: string
  text: string
  textZh: string
}

export type RadioBroadcast = {
  id: string
  slug: string
  title: string
  titleZh: string
  stationId: string
  stationName: string
  stationFrequency: string
  stationCity: string
  category: RadioCategory
  categoryLabel: string
  categoryLabelZh: string
  broadcastDate: string
  durationSeconds: number
  audioUrl: string
  audioFallbackUrl?: string
  anchor: string
  coverGradient: string
  summary: string
  summaryZh: string
  keyLexis: RadioVocabularyItem[]
  segments: RadioSegment[]
}

export type RadioStation = {
  id: string
  name: string
  nameZh: string
  frequency: string
  badge: string
  badgeZh: string
  city: string
  cityZh: string
  description: string
  descriptionZh: string
  color: string
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'metro-985',
    name: 'Metro 98.5 FM',
    nameZh: '都市之声 98.5 FM',
    frequency: '98.5 FM',
    badge: 'Civic & Community Broadcaster',
    badgeZh: '城市公用与社区广播',
    city: 'London & Greater Metro',
    cityZh: '伦敦与都市圈',
    description: 'Local neighborhood bulletins, metropolitan transport, public safety, and civic events.',
    descriptionZh: '聚焦本地社区通报、城市慢行交通、公共治安与市民生活动态。',
    color: 'emerald',
  },
  {
    id: 'bbc-913',
    name: 'BBC World Service 91.3 FM',
    nameZh: 'BBC 国际广播 91.3 FM',
    frequency: '91.3 FM',
    badge: 'Global Dispatch & Analysis',
    badgeZh: '环球视野与深度述评',
    city: 'International Broadcasting Centre',
    cityZh: '国际广播中心',
    description: 'Worldwide news, marine ecology, international climate accords, and global economy.',
    descriptionZh: '全球要闻、海洋生态保护、国际经贸与前沿地缘述评。',
    color: 'blue',
  },
  {
    id: 'eco-1042',
    name: 'Eco-Horizon 104.2 FM',
    nameZh: '未来生态 104.2 FM',
    frequency: '104.2 FM',
    badge: 'Architecture & Environment',
    badgeZh: '绿色建筑与生态科学',
    city: 'Cambridge & Innovation Park',
    cityZh: '剑桥创新科学园',
    description: 'Subterranean cooling architecture, zero-carbon engineering, and urban vertical agriculture.',
    descriptionZh: '地下自然通风制冷建筑、零碳水网与都市立体垂直农业创新。',
    color: 'teal',
  },
  {
    id: 'capital-958',
    name: 'Capital Culture 95.8 FM',
    nameZh: '首都文化 95.8 FM',
    frequency: '95.8 FM',
    badge: 'Arts & Heritage Chronicle',
    badgeZh: '人文艺术与历史遗产',
    city: 'Southbank Cultural Quarter',
    cityZh: '南岸文化街区',
    description: 'Historic fortress preservation, workplace mentorship, museum curation, and public exhibitions.',
    descriptionZh: '历史古堡风貌保护、创意工坊学徒传承、博物馆策展与市民夜校。',
    color: 'amber',
  },
]

export const RADIO_BROADCASTS: RadioBroadcast[] = [
  {
    id: 'rb-metro-morning-01',
    slug: 'metro-community-bulletin-police-report',
    stationId: 'metro-985',
    stationName: 'Metro 98.5 FM',
    stationFrequency: '98.5 FM',
    stationCity: 'London & Greater Metro',
    category: 'community',
    categoryLabel: 'Local Community',
    categoryLabelZh: '本地社区生活',
    broadcastDate: '2026-11-10 07:30',
    title: 'Morning Metro Bulletin: Civic Safety Briefing & Downtown Pedestrian Zone',
    titleZh: '晨间都市简报：市民公共安全登记与商业步行街慢行系统',
    durationSeconds: 523,
    audioUrl: '/audio/listening/cam14-t1-s1.m4a',
    audioFallbackUrl: '/audio/listening/cam14-t1-s1.mp3',
    anchor: 'Desk Officer & Canadian Guest Louise Taylor',
    coverGradient: 'from-emerald-600 via-teal-700 to-slate-900',
    summary:
      'A special on-the-ground report from the central metropolitan police desk. Canadian visitor Louise Taylor logs a municipal incident, shedding light on tourist belongings, King Street rental accommodations, and downtown museum security.',
    summaryZh:
      '中央警署早间现场通报。加拿大游客路易丝·泰勒就金街公寓租住、随身物品安全及博物馆公共展区防护进行现场笔录，展现伦敦日常市民公共服务的规范细节。',
    keyLexis: [
      {
        word: 'theft',
        pos: 'n.',
        ipa: '/θeft/',
        meaning: '盗窃罪，偷窃行为',
        band: 'Band 6.0',
        contextSnippet: 'I want to report a theft. I had some things stolen out of my bag yesterday.',
      },
      {
        word: 'antique',
        pos: 'n./adj.',
        ipa: '/ænˈtiːk/',
        meaning: '古董，古玩；古老的',
        band: 'Band 6.5',
        contextSnippet: 'I come over to buy old furniture, antiques you know.',
      },
      {
        word: 'apartment',
        pos: 'n.',
        ipa: '/əˈpɑːt.mənt/',
        meaning: '公寓套房，住宅单元',
        band: 'Band 6.0',
        contextSnippet: 'Well at present I’ve got a place at Park Apartments, that’s on King Street.',
      },
      {
        word: 'exhibition',
        pos: 'n.',
        ipa: '/ˌek.sɪˈbɪʃ.ən/',
        meaning: '展览会，公发展览',
        band: 'Band 6.5',
        contextSnippet: 'I’d been to an exhibition and I was standing outside the museum.',
      },
      {
        word: 'approximately',
        pos: 'adv.',
        ipa: '/əˈprɒk.sɪ.mət.li/',
        meaning: '大约，大概，近似地',
        band: 'Band 7.0',
        contextSnippet: 'Approximately 250 pounds in cash, and some credit cards.',
      },
      {
        word: 'clog',
        pos: 'v./n.',
        ipa: '/klɒɡ/',
        meaning: '堵塞，阻碍；木屐',
        band: 'Band 6.5',
        contextSnippet: 'Traffic delays can clog pedestrian avenues during peak tourist hours.',
      },
    ],
    segments: [
      {
        id: 'rb-seg-01-0',
        startSecond: 0,
        endSecond: 78,
        speaker: 'News Anchor',
        speakerRole: 'Metro 98.5 Morning Announcer',
        text: 'This is Metro 98.5 FM, your civic morning dispatch across London. Coming up: local neighbourhood updates, safety bulletins, and transit advisories for central shopping districts.',
        textZh: '【都市之声 98.5 FM】这里是伦敦全城晨间市民广播。接下来的重点关注：社区民生通报、公共治安指引以及中心购物商圈的慢行出行建议。',
      },
      {
        id: 'rb-seg-01-1',
        startSecond: 78,
        endSecond: 120,
        speaker: 'Officer & Visitor',
        speakerRole: 'Desk Officer & Louise Taylor',
        text: 'Good morning. What can I do for you? Louise: I want to report a theft. I had some things stolen out of my bag yesterday. Officer: I’m sorry to hear that. Right, so I’ll need to take a few details. Can I start with your name? Louise: Louise Taylor. Officer: OK, thank you. And are you resident in the UK? Louise: No, I’m actually Canadian. Though my mother was British.',
        textZh: '警官：早上好，有什么可以帮您？路易丝：我想报案。昨天我包里的东西被偷了。警官：很遗憾听到这个。我需要登记一些信息，能先告诉我您的姓名吗？路易丝：路易丝·泰勒。警官：好的，您是英国居民吗？路易丝：不，我其实是加拿大人，虽然我母亲是英国人。',
      },
      {
        id: 'rb-seg-01-2',
        startSecond: 120,
        endSecond: 168,
        speaker: 'Officer & Visitor',
        speakerRole: 'Desk Officer & Louise Taylor',
        text: 'Officer: And your date of birth? Louise: December 14th, 1977. Officer: So you’re just visiting this country? Louise: That’s right. I come over most summers on business. I’m an interior designer and I come over to buy old furniture, antiques you know. There are some really lovely things around here, but you need to get out to the small towns.',
        textZh: '警官：出生日期？路易丝：1977年12月14日。警官：那您只是来访？路易丝：是的，我大多数夏天都因商务来这。我是一名室内设计师，来这采购古董家具。周边有非常不错的好物件，不过需要到各周边小镇去淘宝。',
      },
      {
        id: 'rb-seg-01-3',
        startSecond: 168,
        endSecond: 215,
        speaker: 'Officer & Visitor',
        speakerRole: 'Desk Officer & Louise Taylor',
        text: 'Officer: So you’ve been here quite a while? Louise: Yes, I’m here for two months. I go back next week. Officer: So may I ask where you’re staying now? Louise: Well at present I’ve got a place at Park Apartments, that’s on King Street. I was staying at the Riverside Apartments on the same street, but the apartment there was only available for six weeks so I had to find another one. Officer: OK. And the apartment number? Louise: Fifteen.',
        textZh: '警官：那您在这待挺久了？路易丝：两个月了，下周回国。警官：您现在住在哪里？路易丝：目前我住在公园公寓，在金街15号。我之前住在同一条街的河畔公寓，但那只能租6周。',
      },
      {
        id: 'rb-seg-01-4',
        startSecond: 215,
        endSecond: 295,
        speaker: 'Officer & Visitor',
        speakerRole: 'Desk Officer & Louise Taylor',
        text: 'Officer: Right. Now, can you tell me what you had stolen? Louise: Well, it was a large handbag, and inside it was my wallet. Officer: And how much money was in that? Louise: Approximately 250 pounds in cash, and some credit cards. Officer: Anything else? Louise: Yes, my phone. A silver smartphone with a cracked screen.',
        textZh: '警官：好的。现在请告诉我被盗了什么？路易丝：一个大手提包，里面有我的钱包。警官：里面大概有多少钱？路易丝：大约250英镑现金，还有几张信用卡。警官：还有其他物品吗？路易丝：有，我的手机，一部屏幕有裂纹的银色智能手机。',
      },
      {
        id: 'rb-seg-01-5',
        startSecond: 295,
        endSecond: 360,
        speaker: 'Officer & Visitor',
        speakerRole: 'Desk Officer & Louise Taylor',
        text: 'Officer: And what was the date of the theft? Louise: It happened on the tenth of September, in the afternoon. Officer: Where were you when it was stolen? Louise: I’d been to an exhibition and I was standing outside the museum waiting for a friend at about four o’clock, when a group of teenagers approached me.',
        textZh: '警官：被盗的具体日期是？路易丝：发生在9月10日下午。警官：事发时您在哪里？路易丝：我刚看完展览，大约4点钟站在博物馆外面等朋友，这时有一群年轻人走近了我。',
      },
      {
        id: 'rb-seg-01-6',
        startSecond: 360,
        endSecond: 450,
        speaker: 'Officer & Visitor',
        speakerRole: 'Desk Officer & Louise Taylor',
        text: 'Officer: Did you notice any identifying features on them? Louise: One of them was wearing a bright blue hoodie with white trainers. The other had a skateboard. Officer: Thank you. We will issue you a crime reference number: 8794 3321 00. You can submit this to your travel insurer.',
        textZh: '警官：您注意到他们的特征了吗？路易丝：其中一人穿着亮蓝色卫衣配白球鞋，另一人拿着滑板。警官：好的，我们为您开具立案编号：8794 3321 00。您可以凭此向旅行保险机构报销。',
      },
    ],
  },
  {
    id: 'rb-bbc-world-02',
    slug: 'bbc-world-service-marine-conservation-energy',
    stationId: 'bbc-913',
    stationName: 'BBC World Service 91.3 FM',
    stationFrequency: '91.3 FM',
    stationCity: 'International Broadcasting Centre',
    category: 'world',
    categoryLabel: 'Global Ecology',
    categoryLabelZh: '全球经贸与海洋保护',
    broadcastDate: '2026-11-10 12:00',
    title: 'World Insight: Marine Biodiversity Sanctuaries & Tidal Energy Engineering',
    titleZh: '环球深度述评：海洋生物多样性保护走廊与潮汐清洁能源工程',
    durationSeconds: 495,
    audioUrl: '/audio/listening/cam14-t1-s4.m4a',
    audioFallbackUrl: '/audio/listening/cam14-t1-s4.mp3',
    anchor: 'Prof. Alistair Vance & Ocean Policy Correspondent',
    coverGradient: 'from-blue-600 via-indigo-800 to-slate-950',
    summary:
      'A deep dive into sustainable ocean engineering. Exploring marine life protection around tidal turbines, coastal sediment replenishment, and international cooperation across shelf ecosystems.',
    summaryZh:
      'BBC 国际广播深度专题。聚焦潮汐发电机组周围的海洋生态系统保护、近海泥沙冲淤补偿机制以及大陆架跨国生物多样性走廊。',
    keyLexis: [
      {
        word: 'marine',
        pos: 'adj.',
        ipa: '/məˈriːn/',
        meaning: '海洋的，海生的',
        band: 'Band 7.0',
        contextSnippet: 'Marine ecosystems require delicate management around tidal power installations.',
      },
      {
        word: 'biodiversity',
        pos: 'n.',
        ipa: '/ˌbaɪ.əʊ.daɪˈvɜː.sə.ti/',
        meaning: '生物多样性',
        band: 'Band 7.5',
        contextSnippet: 'Preserving coastal biodiversity remains a top priority for international treaties.',
      },
      {
        word: 'turbine',
        pos: 'n.',
        ipa: '/ˈtɜː.baɪn/',
        meaning: '涡轮机，水轮机',
        band: 'Band 7.0',
        contextSnippet: 'Submerged underwater turbines capture kinetic energy from tidal currents.',
      },
      {
        word: 'sediment',
        pos: 'n.',
        ipa: '/ˈsed.ɪ.mənt/',
        meaning: '沉积物，沉淀物',
        band: 'Band 7.5',
        contextSnippet: 'The movement of sea floor sediment can alter local shoreline morphology.',
      },
      {
        word: 'sustainable',
        pos: 'adj.',
        ipa: '/səˈsteɪ.nə.bəl/',
        meaning: '可持续的，可维系的',
        band: 'Band 6.5',
        contextSnippet: 'Sustainable harvesting practices safeguard fisheries for future generations.',
      },
    ],
    segments: [
      {
        id: 'rb-seg-02-0',
        startSecond: 0,
        endSecond: 65,
        speaker: 'BBC Announcer',
        speakerRole: 'World Service Anchor',
        text: 'This is the BBC World Service. In today’s special environmental report, we examine renewable ocean power and its ecological footprints across coastal waters.',
        textZh: '【BBC 国际广播】这里是 BBC 国际广播电台。在今天的环境特别专题中，我们将深入探讨近海可再生海洋清洁能源及其对沿岸海域的生态影响。',
      },
      {
        id: 'rb-seg-02-1',
        startSecond: 65,
        endSecond: 150,
        speaker: 'Prof. Vance',
        speakerRole: 'Marine Ecologist',
        text: 'Producing electricity from tidal currents represents an immense technological leap. Unlike wind or solar generation, tides are completely predictable decades into the future.',
        textZh: '利用潮汐洋流发电是一项巨大的技术飞跃。与风能或太阳能不同，未来数十年的潮汐规律完全可以被精确预测。',
      },
      {
        id: 'rb-seg-02-2',
        startSecond: 150,
        endSecond: 260,
        speaker: 'Prof. Vance',
        speakerRole: 'Marine Ecologist',
        text: 'However, environmental biologists must scrutinize the impact on local fish migrations. The slowly rotating blades are designed with acoustic sensors that temporarily pause rotation when mammalian pods approach.',
        textZh: '然而，环境生物学家必须严密审视这对鱼类洄游的影响。缓慢旋转的水下叶片配备了声学传感器，当鲸豚等海洋哺乳动物群靠近时，机组会自动减速暂停。',
      },
      {
        id: 'rb-seg-02-3',
        startSecond: 260,
        endSecond: 380,
        speaker: 'Policy Correspondent',
        speakerRole: 'Maritime Policy Specialist',
        text: 'Furthermore, the artificial reefs created around the anchor foundations have fostered unexpected thriving colonies of sea anemones, crabs, and juvenile cod, demonstrating that green engineering can coexist with marine life.',
        textZh: '此外，固定锚基周围形成的人工鱼礁意外孕育了繁盛的海葵、海蟹及幼年鳕鱼群落，证明绿色工程完全可以与海洋生命共生共荣。',
      },
      {
        id: 'rb-seg-02-4',
        startSecond: 380,
        endSecond: 495,
        speaker: 'Prof. Vance',
        speakerRole: 'Marine Ecologist',
        text: 'In conclusion, international collaboration in sharing oceanographic telemetry data will be the bedrock for sustainable coastal energy in the coming decades.',
        textZh: '总而言之，共享海洋遥测数据的跨国科研协作，将成为未来几十年全球沿海可持续清洁能源开发的坚实基石。',
      },
    ],
  },
  {
    id: 'rb-eco-horizon-03',
    slug: 'eco-horizon-subterranean-cooling-architecture',
    stationId: 'eco-1042',
    stationName: 'Eco-Horizon 104.2 FM',
    stationFrequency: '104.2 FM',
    stationCity: 'Cambridge & Innovation Park',
    category: 'science',
    categoryLabel: 'Science & Environment',
    categoryLabelZh: '绿色建筑与生态科学',
    broadcastDate: '2026-11-10 15:15',
    title: 'Eco-Horizon Special: Subterranean Cooling & Ancient Vernacular Earth Tubes',
    titleZh: '前沿生态专栏：地下风道制冷科技与传统土管被动式散热',
    durationSeconds: 405,
    audioUrl: '/audio/listening/cam14-t1-s3.m4a',
    audioFallbackUrl: '/audio/listening/cam14-t1-s3.mp3',
    anchor: 'Julian Edwards & Dr. Natalie Evans',
    coverGradient: 'from-teal-600 via-emerald-800 to-slate-900',
    summary:
      'How architectural engineers adapt Persian qanats and subterranean ground-coupled air tunnels to replace power-hungry air conditioning in contemporary sustainable cities.',
    summaryZh:
      '剑桥绿色建筑实验室访谈。探讨现代建筑师如何汲取古代地下坎儿井与被动式地埋风管工程智慧，在零耗电前提下实现现代都市建筑的夏季降温与持续换气。',
    keyLexis: [
      {
        word: 'subterranean',
        pos: 'adj.',
        ipa: '/ˌsʌb.təˈreɪ.ni.ən/',
        meaning: '地下的，地表之下的',
        band: 'Band 7.5',
        contextSnippet: 'Subterranean earth tubes take advantage of stable soil temperatures.',
      },
      {
        word: 'convection',
        pos: 'n.',
        ipa: '/kənˈvek.ʃən/',
        meaning: '对流（热传导方式）',
        band: 'Band 7.0',
        contextSnippet: 'Natural convection draws warm ambient air upward and vents it out.',
      },
      {
        word: 'vernacular',
        pos: 'adj./n.',
        ipa: '/vəˈnæk.jə.lər/',
        meaning: '地方风土的，民间的；乡土建筑',
        band: 'Band 8.0',
        contextSnippet: 'Vernacular engineering techniques survived centuries of harsh desert climates.',
      },
      {
        word: 'insulation',
        pos: 'n.',
        ipa: '/ˌɪn.sjəˈleɪ.ʃən/',
        meaning: '隔热，绝缘材料',
        band: 'Band 6.5',
        contextSnippet: 'Thick adobe walls offer natural thermal insulation against midday heat.',
      },
      {
        word: 'ventilation',
        pos: 'n.',
        ipa: '/ˌven.tɪˈleɪ.ʃən/',
        meaning: '通风，换气系统',
        band: 'Band 6.5',
        contextSnippet: 'Adequate cross ventilation maintains healthy indoor air quality.',
      },
    ],
    segments: [
      {
        id: 'rb-seg-03-0',
        startSecond: 0,
        endSecond: 55,
        speaker: 'Radio Host',
        speakerRole: 'Eco-Horizon Presenter',
        text: 'Welcome back to Eco-Horizon 104.2 FM. Today, we look at the renaissance of subterranean cooling, where ancient vernacular building science meets twenty-first century zero-emission architecture.',
        textZh: '【未来生态 104.2 FM】欢迎回到前沿生态专栏。今天我们将探讨地下风道制冷的当代复兴，见证古老乡土建筑科学与21世纪零碳建筑的创新融合。',
      },
      {
        id: 'rb-seg-03-1',
        startSecond: 55,
        endSecond: 140,
        speaker: 'Dr. Evans',
        speakerRole: 'Sustainable Architecture Fellow',
        text: 'Long before mechanical compressors transformed modern cities, communities on the Iranian plateau mastered passive geothermal cooling through underground qanat channels and wind-catching towers known as badgirs.',
        textZh: '在机械压缩式空调问世之前，伊朗高原的居民早已通过地下坎儿井暗渠与捕风塔（Badgir），掌握了依靠自然压差与地热温差的被动式空气净化制冷技艺。',
      },
      {
        id: 'rb-seg-03-2',
        startSecond: 140,
        endSecond: 240,
        speaker: 'Julian Edwards',
        speakerRole: 'Urban Design Researcher',
        text: 'Modern university campuses are now embedding concrete earth tubes four metres underground. By the time outdoor air travels sixty metres through these tubes, it naturally drops twelve degrees Celsius without burning a single watt of grid power.',
        textZh: '如今，多所现代大学校园在地下4米处预埋了大型混凝土风道。当外部38度的滚烫空气经过长达60米的地下风道流动时，自然降温达12摄氏度，无需耗费一度电网电力。',
      },
      {
        id: 'rb-seg-03-3',
        startSecond: 240,
        endSecond: 340,
        speaker: 'Dr. Evans',
        speakerRole: 'Sustainable Architecture Fellow',
        text: 'The solar chimney effect at the roof acts like a thermal engine. Solar heat collects at the glass penthouse, creating a buoyant updraft that gently sucks fresh cool air up through all occupied classrooms.',
        textZh: '顶层的太阳能烟囱效应如同热力引擎。顶层玻璃采光井吸收阳光升温形成强劲上升气流，从而轻柔地将地下凉爽新鲜空气抽取至整栋建筑的每一个教室。',
      },
      {
        id: 'rb-seg-03-4',
        startSecond: 340,
        endSecond: 405,
        speaker: 'Julian Edwards',
        speakerRole: 'Urban Design Researcher',
        text: 'This blend of passive physics and structural design shows that the most durable ecological innovations often stem from humble historical precedents.',
        textZh: '这种被动式物理学与现代结构设计的完美结合表明，最具持久生命力的生态创新，往往深深植根于敬畏自然的古代工程智慧之中。',
      },
    ],
  },
  {
    id: 'rb-capital-culture-04',
    slug: 'capital-culture-castle-preservation-heritage',
    stationId: 'capital-958',
    stationName: 'Capital Culture 95.8 FM',
    stationFrequency: '95.8 FM',
    stationCity: 'Southbank Cultural Quarter',
    category: 'culture',
    categoryLabel: 'Arts & Heritage',
    categoryLabelZh: '人文艺术与历史遗产',
    broadcastDate: '2026-11-10 18:45',
    title: 'Heritage Chronicle: Branley Castle Restoration & Historic Fortress Living',
    titleZh: '人文遗产纪实：布兰利古堡修缮与中世纪要塞历史生活漫步',
    durationSeconds: 430,
    audioUrl: '/audio/listening/cam14-t2-s2.m4a',
    audioFallbackUrl: '/audio/listening/cam14-t2-s2.mp3',
    anchor: 'Curator Janet & Arts Correspondent',
    coverGradient: 'from-amber-600 via-stone-800 to-zinc-950',
    summary:
      'A cultural tour of historic fortress architecture. Tracing medieval masonry, grand dining halls, defensive moat hydraulics, and hands-on heritage education for visiting families.',
    summaryZh:
      '南岸文化广播古建特辑。带领听众漫步具有七百年历史的布兰利古堡，领略中世纪石工砌体、挑空国宴厅、护城河水利暗渠与面向青少年的传统手工艺活化传承。',
    keyLexis: [
      {
        word: 'heritage',
        pos: 'n.',
        ipa: '/ˈher.ɪ.tɪdʒ/',
        meaning: '遗产，传统文化遗产',
        band: 'Band 7.0',
        contextSnippet: 'Protecting architectural heritage requires careful traditional masonry skills.',
      },
      {
        word: 'fortress',
        pos: 'n.',
        ipa: '/ˈfɔː.trəs/',
        meaning: '堡垒，要塞',
        band: 'Band 6.5',
        contextSnippet: 'The stone fortress defended the river crossing throughout the middle ages.',
      },
      {
        word: 'curate',
        pos: 'v.',
        ipa: '/kjʊəˈreɪt/',
        meaning: '策划，整理展品，策展',
        band: 'Band 7.5',
        contextSnippet: 'Curators have restored original medieval tapestries in the great hall.',
      },
      {
        word: 'renovation',
        pos: 'n.',
        ipa: '/ˌren.əˈveɪ.ʃən/',
        meaning: '整修，翻新工程',
        band: 'Band 6.5',
        contextSnippet: 'The latest renovation unveiled hidden murals beneath old plasterwork.',
      },
      {
        word: 'apprentice',
        pos: 'n.',
        ipa: '/əˈpren.tɪs/',
        meaning: '学徒，徒弟',
        band: 'Band 6.5',
        contextSnippet: 'Master stone carvers are training young apprentices in lime mortar repair.',
      },
    ],
    segments: [
      {
        id: 'rb-seg-04-0',
        startSecond: 0,
        endSecond: 60,
        speaker: 'Culture Host',
        speakerRole: 'Capital Arts Anchor',
        text: 'Good evening. This is Capital Culture 95.8 FM. Tonight, we visit Branley Castle, where a three-year conservation initiative has just revitalized one of the region’s finest medieval defensive strongholds.',
        textZh: '【首都文化 95.8 FM】晚上好，这里是首都文化之声。今晚我们将走进布兰利古堡，历时三年的保护性修缮工程刚刚完工，让这座英国最著名的中世纪要塞重焕生机。',
      },
      {
        id: 'rb-seg-04-1',
        startSecond: 60,
        endSecond: 160,
        speaker: 'Curator Janet',
        speakerRole: 'Chief Fortress Conservator',
        text: 'The castle grounds date back to the early twelfth century. When our restoration crew began work on the northern bailey, we found medieval drainage conduits that were remarkably functional even after centuries of disuse.',
        textZh: '古堡的历史可以追溯到12世纪初。当我们的文物修缮队在北堡场施工时，意外发现了保存完好的中世纪排水管道，历经数百年岁月洗礼依然具备出色的导水功能。',
      },
      {
        id: 'rb-seg-04-2',
        startSecond: 160,
        endSecond: 260,
        speaker: 'Curator Janet',
        speakerRole: 'Chief Fortress Conservator',
        text: 'Visitors can now explore the Great Chamber with interactive displays that show how castle inhabitants survived freezing winter sieges, and how local guilds of blacksmiths forged essential armor and iron fittings.',
        textZh: '参观者如今可以在大议事厅内通过互动展陈，亲身体验昔日守城军民如何抵御严冬围困，以及本地铁匠行会如何手工锻造防御甲胄与重型铰链。',
      },
      {
        id: 'rb-seg-04-3',
        startSecond: 260,
        endSecond: 350,
        speaker: 'Arts Correspondent',
        speakerRole: 'Cultural Journalist',
        text: 'What is particularly inspiring is the live apprenticeship forge on site, where master craftsmen demonstrate ancient timber framing and lime washing techniques to visiting students and families.',
        textZh: '尤为令人振奋的是古堡内设立的活态学徒工坊。非遗石雕与木作师傅在这里现场演示传统的榫卯木架构与石灰粉刷工艺，向市民和学子面对面传授匠心。',
      },
      {
        id: 'rb-seg-04-4',
        startSecond: 350,
        endSecond: 430,
        speaker: 'Curator Janet',
        speakerRole: 'Chief Fortress Conservator',
        text: 'Preserving our built heritage is never about locking things away in glass cases. It is about keeping these vibrant community spaces active for future generations to explore.',
        textZh: '保护历史建筑从来不是把文物锁在玻璃展柜里，而是让这些充满历史沉淀的公共文化空间生生不息，供一代代年轻人继续探索与体悟。',
      },
    ],
  },
]

export function getRadioStations(): RadioStation[] {
  return RADIO_STATIONS
}

export function getRadioBroadcasts(category?: RadioCategory): RadioBroadcast[] {
  if (!category || category === 'all') {
    return RADIO_BROADCASTS
  }
  return RADIO_BROADCASTS.filter((b) => b.category === category)
}

export function getRadioBroadcastById(id: string): RadioBroadcast | undefined {
  return RADIO_BROADCASTS.find((b) => b.id === id || b.slug === id)
}
