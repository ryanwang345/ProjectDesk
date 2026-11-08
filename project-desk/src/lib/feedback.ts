import type { EnglishCard } from '@/lib/english'
import type { Question } from '@/lib/lesson'

export type WordKind = 'n' | 'v' | 'vi' | 'adj' | 'adv'

type Frame = { kind: WordKind; en: string; zh: string }

const frames: Frame[] = [
  { kind: 'n', en: 'I looked up %s before the seminar.', zh: '研讨之前，我查了一下%s。' },
  { kind: 'n', en: 'The lecture kept coming back to %s.', zh: '这堂课一直绕回到%s。' },
  { kind: 'n', en: 'She wrote %s in the margin so she would remember it.', zh: '她把%s写在页边，免得忘掉。' },
  { kind: 'n', en: 'We argued about %s on the way home.', zh: '回家的路上，我们为%s争了起来。' },
  { kind: 'n', en: 'The article mentions %s in the opening paragraph.', zh: '文章一开头就提到了%s。' },
  { kind: 'n', en: 'He asked what %s means in ordinary words.', zh: '他问%s用大白话怎么说。' },
  { kind: 'n', en: 'My draft is weak because I skipped %s.', zh: '草稿很弱，因为我跳过了%s。' },
  { kind: 'n', en: 'The group spent an hour on %s and still disagreed.', zh: '小组为%s花了一小时，还是没谈拢。' },
  { kind: 'n', en: 'I can give a daily-life example of %s.', zh: '我能给%s举一个生活里的例子。' },
  { kind: 'n', en: 'If the exam asks about %s, define it first.', zh: '要是考试问到%s，先给它下个定义。' },
  { kind: 'v', en: 'She was not sure how to %s.', zh: '她不确定该怎么%s。' },
  { kind: 'v', en: 'The instructions tell you to %s.', zh: '题目让你去%s。' },
  { kind: 'v', en: 'I stayed late so I could %s.', zh: '我留到很晚，就是为了%s。' },
  { kind: 'v', en: 'He paused, then chose to %s.', zh: '他顿了顿，然后决定%s。' },
  { kind: 'v', en: 'We practised until we could %s without notes.', zh: '我们练到不看笔记也能%s。' },
  { kind: 'v', en: 'The tutor asked whether we should %s.', zh: '导师问我们到底该不该%s。' },
  { kind: 'v', en: 'It is harder than it looks to %s.', zh: '%s这件事，做起来比看上去难。' },
  { kind: 'v', en: 'They agreed it was time to %s.', zh: '他们觉得是时候%s了。' },
  { kind: 'v', en: 'You can lose marks if you forget to %s.', zh: '要是忘了%s，就会丢分。' },
  { kind: 'v', en: 'Let me %s, and you tell me if it sounds right.', zh: '我来%s，你听听顺不顺。' },
  { kind: 'vi', en: 'This kind of change can %s over a few years.', zh: '这种变化可能在几年里%s。' },
  { kind: 'vi', en: 'The same thing may %s in another city.', zh: '同样的事也可能在另一座城市%s。' },
  { kind: 'vi', en: 'Nothing will %s if we keep the old plan.', zh: '还用旧计划的话，什么都不会%s。' },
  { kind: 'vi', en: 'Small problems %s when the rules are new.', zh: '规则刚换，小问题就会%s。' },
  { kind: 'vi', en: 'The effect can %s without any warning.', zh: '这种影响可能一声不响地%s。' },
  { kind: 'vi', en: 'We watched the numbers %s from one year to the next.', zh: '我们看着数字一年一年地%s。' },
  { kind: 'vi', en: 'A new habit can %s once people see the benefit.', zh: '人们看到好处，新习惯就会%s。' },
  { kind: 'vi', en: 'The gap may %s if funding stops.', zh: '资金一停，差距就可能%s。' },
  { kind: 'vi', en: 'These events %s more often in winter.', zh: '这些事到了冬天更常%s。' },
  { kind: 'vi', en: 'Researchers want to know why it began to %s.', zh: '研究者想知道它为什么开始%s。' },
  { kind: 'adj', en: 'The result looks %s once you see the chart.', zh: '一看图表，结果就显得%s。' },
  { kind: 'adj', en: 'Her answer sounded %s, and she had the numbers.', zh: '她的回答听着%s，而且她有数字。' },
  { kind: 'adj', en: 'The problem became %s after the new rule.', zh: '新规定一出，问题就变得%s。' },
  { kind: 'adj', en: 'Everyone in the room called the idea %s.', zh: '在场的人都说这个想法%s。' },
  { kind: 'adj', en: 'The two groups are %s in one important way.', zh: '这两组有一个要紧的地方是%s的。' },
  { kind: 'adj', en: 'The evidence seems %s to most readers.', zh: '大多数读者觉得证据%s。' },
  { kind: 'adj', en: 'Readers found the tone %s.', zh: '读者觉得这个语气%s。' },
  { kind: 'adj', en: 'The author treats the issue as %s.', zh: '作者把这件事看成%s。' },
  { kind: 'adj', en: 'On the page, the change is %s.', zh: '写在纸上，这个变化是%s的。' },
  { kind: 'adj', en: 'I would not call that example %s.', zh: '我不会说那个例子%s。' },
  { kind: 'adv', en: 'The numbers moved %s over ten years.', zh: '这些数字十年里%s地动了。' },
  { kind: 'adv', en: 'She explained the result %s, then gave an example.', zh: '她%s地讲完结果，又举了个例子。' },
  { kind: 'adv', en: 'Costs rose %s after the new rule.', zh: '新规定之后，成本%s地涨了。' },
  { kind: 'adv', en: 'Read the question %s before you answer.', zh: '答题前先%s地把题读一遍。' },
  { kind: 'adv', en: 'The city grew %s during those years.', zh: '那些年，这座城市%s地长大了。' },
  { kind: 'adv', en: 'He replied %s and sat down.', zh: '他%s地答完，就坐下了。' },
  { kind: 'adv', en: 'Prices fell %s in the last year.', zh: '最后一年，价格%s地掉了。' },
  { kind: 'adv', en: 'The writer states the claim %s.', zh: '作者%s地把主张说了出来。' },
  { kind: 'adv', en: 'Attendance climbed %s from 2010 to 2020.', zh: '2010到2020年，出勤%s地往上走。' },
  { kind: 'adv', en: 'The team worked %s and still made the deadline.', zh: '团队%s地赶工，还是赶上了截止日期。' },
]

export type AnswerNote = {
  pickedKind: WordKind | null
  answerKind: WordKind | null
  pickedMeaning: string
  answerMeaning: string
  english: string | null
  chinese: string | null
}

function cardFor(cards: EnglishCard[], word: string): EnglishCard | undefined {
  const key = word.trim().toLowerCase()
  return cards.find((card) => card.word.trim().toLowerCase() === key)
}

function matchFrame(sentence: string, word: string): Frame | null {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (at < 0) return null
  const pattern = `${sentence.slice(0, at)}%s${sentence.slice(at + word.length)}`.toLowerCase()
  return frames.find((frame) => frame.en.toLowerCase() === pattern) ?? null
}

function fillChinese(template: string, meaning: string): string {
  if (template.includes('%s的') && meaning.endsWith('的')) return template.replace('%s的', meaning)
  const gloss = meaning.endsWith('的') ? meaning.slice(0, -1) : meaning
  return template.replace('%s', gloss)
}

export function translateSentence(sentence: string, word: string, meaning: string): string | null {
  const frame = matchFrame(sentence, word)
  if (!frame) return null
  return fillChinese(frame.zh, meaning)
}

function kindOf(card: EnglishCard | undefined): WordKind | null {
  if (!card) return null
  for (const example of card.examples) {
    const frame = matchFrame(example, card.word)
    if (frame) return frame.kind
  }
  return null
}

export function answerNote(question: Question, picked: string, cards: EnglishCard[]): AnswerNote {
  if (question.kind === 'meaning') {
    const card = cardFor(cards, question.prompt)
    return {
      pickedKind: null,
      answerKind: kindOf(card),
      pickedMeaning: picked,
      answerMeaning: question.answer,
      english: null,
      chinese: null,
    }
  }

  const answer = cardFor(cards, question.answer)
  const chosen = cardFor(cards, picked)
  const english = `${question.before}${question.answer}${question.after}`
  const frame = matchFrame(english, question.answer)
  return {
    pickedKind: kindOf(chosen),
    answerKind: frame?.kind ?? kindOf(answer),
    pickedMeaning: chosen?.meaning ?? '',
    answerMeaning: answer?.meaning ?? '',
    english,
    chinese: frame && answer ? fillChinese(frame.zh, answer.meaning) : null,
  }
}
