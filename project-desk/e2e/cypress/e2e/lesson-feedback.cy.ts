import type { EnglishCard } from '../../../src/lib/english'
import type { Question } from '../../../src/lib/lesson'

const cards: EnglishCard[] = [
  { word: 'abroad', meaning: '在国外' },
  { word: 'aboard', meaning: '在船、飞机或火车上' },
  { word: 'absence', meaning: '缺席' },
  { word: 'abortion', meaning: '流产' },
  { word: 'abandon', meaning: '放弃' },
].map(({ word, meaning }) => ({
  id: word, word, meaning, examples: [`A saved example with ${word}.`],
  inReview: false, generated: true, pronunciation: '/test/',
  senses: [], updatedAt: '2026-11-08T00:00:00Z',
  band: { collocations: [], writing: '', speaking: '', weak: '', fix: '', paraphrases: [], zh: '' },
}))

const questions: Question[] = [
  {
    id: 'abroad-cloze', kind: 'cloze', before: 'The lecturer stated the claim ', after: '.', answer: 'abroad',
    choices: ['abroad', 'aboard', 'absence', 'abortion'],
    why: 'Abroad means in another country; aboard means on a ship, plane, or train.',
    chinese: '讲师在国外陈述了这一主张。',
  },
  {
    id: 'aboard-cloze', kind: 'cloze', before: 'The passengers stepped ', after: ' the train before it departed.', answer: 'aboard',
    choices: ['abroad', 'aboard', 'absence', 'abandon'],
    why: 'Aboard means on or into a ship, plane, or train.', chinese: '乘客们在火车发车前上了车。',
  },
  {
    id: 'abroad-meaning', kind: 'meaning', prompt: 'abroad', answer: '在国外',
    choices: ['在国外', '缺席', '流产', '放弃'], why: 'Abroad means in another country.', chinese: '在国外',
  },
]

function startLesson(locale: 'en' | 'zh' = 'en', quiz: Question[] = questions) {
  // Isolate the lesson UI without generating content or changing learner XP.
  cy.intercept('GET', '/api/english', { body: cards })
  cy.intercept('GET', '/api/english/speech', { body: { available: false } })
  cy.intercept('GET', '/api/learning/progress*', { body: {
    xp: 0, streak: 0, lastDay: '', completed: [], timezone: 'UTC', weekly: [], legacyImported: true,
  } })
  cy.intercept('POST', '/api/english-lessons/0', { body: { cards, questions: quiz } }).as('lesson')
  cy.visit('/english', { onBeforeLoad(win) {
    win.localStorage.setItem('projectdesk.locale', locale)
    win.localStorage.removeItem('projectdesk.english.progress')
  } })
  cy.get(`button[aria-label="${locale === 'en' ? 'Lesson 1' : '第 1 课'}"]`).click()
  cy.wait('@lesson')
  cy.contains('button', locale === 'en' ? 'Start practice (5 words)' : '开始练习（5 个词）').click()
}

function choose(word: string) {
  cy.contains('button', new RegExp(`^[A-D]${word}$`)).click()
}

describe('Vocabulary lesson answer feedback', { tags: '@regression' }, () => {
  it('retains the selected word after checking and separates it from the correction', () => {
    startLesson()
    cy.get('[data-testid="lesson-intended-meaning"]').should('contain', 'Meaning to express: 在国外')
    cy.get('[data-testid="lesson-cloze-selection"]').should('not.contain', 'abroad')
    choose('aboard')
    cy.get('[data-testid="lesson-cloze-selection"]').should('have.text', 'aboard')
    cy.contains('button', /^Check$/).click()
    cy.get('[data-testid="lesson-cloze-selection"]').should('have.text', 'aboard')
    cy.get('[data-testid="lesson-answer-feedback"]').should('contain', 'Not quite')
    cy.get('[data-testid="lesson-answer-comparison"]').should('contain', 'You chose: aboard').and('contain', '在船、飞机或火车上').and('contain', 'Answer: abroad').and('contain', '在国外')
    cy.get('[data-testid="lesson-corrected-sentence"]').should('have.text', 'The lecturer stated the claim abroad.')
    cy.get('[aria-label="4 hearts left"]').should('exist')
    cy.screenshot('lesson-selected-answer-and-correction', { capture: 'viewport' })
    cy.contains('button', 'Next question').click()
    cy.get('[data-testid="lesson-cloze-selection"]').should('not.contain', 'aboard')
    cy.get('[data-testid="lesson-answer-feedback"]').should('not.exist')
  })

  it('accepts abroad for the overseas meaning without losing a heart', () => {
    startLesson()
    choose('abroad')
    cy.contains('button', /^Check$/).click()
    cy.get('[data-testid="lesson-answer-feedback"]').should('contain', 'Correct')
    cy.get('[data-testid="lesson-cloze-selection"]').should('have.text', 'abroad')
    cy.get('[data-testid="lesson-answer-comparison"]').should('not.exist')
    cy.get('[aria-label="5 hearts left"]').should('exist')
  })

  it('accepts aboard in transport context and still grades meaning questions', () => {
    startLesson()
    choose('abroad')
    cy.contains('button', /^Check$/).click()
    cy.contains('button', 'Next question').click()
    cy.get('[data-testid="lesson-intended-meaning"]').should('contain', '在船、飞机或火车上')
    choose('aboard')
    cy.contains('button', /^Check$/).click()
    cy.get('[data-testid="lesson-answer-feedback"]').should('contain', 'Correct')
    cy.get('[data-testid="lesson-cloze-selection"]').should('have.text', 'aboard')
    cy.get('[aria-label="5 hearts left"]').should('exist')
    cy.contains('button', 'Next question').click()
    choose('在国外')
    cy.contains('button', /^Check$/).click()
    cy.get('[data-testid="lesson-answer-feedback"]').should('contain', 'Correct')
    cy.get('[aria-label="5 hearts left"]').should('exist')
  })

  it('accepts capitalization and surrounding whitespace in a saved correct choice', () => {
    const quiz = questions.map((question, index) => index === 0 ? { ...question, choices: [' Abroad ', 'aboard', 'absence', 'abortion'] } : question)
    startLesson('en', quiz)
    cy.contains('button', 'Abroad').click()
    cy.contains('button', /^Check$/).click()
    cy.get('[data-testid="lesson-answer-feedback"]').should('contain', 'Correct')
    cy.get('[data-testid="lesson-cloze-selection"]').should('have.text', ' Abroad ')
    cy.get('[data-testid="lesson-answer-comparison"]').should('not.exist')
    cy.get('[aria-label="5 hearts left"]').should('exist')
  })

  it('shows the selected answer and correction in Chinese on mobile', () => {
    cy.viewport('iphone-x')
    startLesson('zh')
    cy.get('[data-testid="lesson-intended-meaning"]').should('contain', '此处要表达的含义: 在国外')
    choose('aboard')
    cy.contains('button', /^检查$/).click()
    cy.get('[data-testid="lesson-cloze-selection"]').should('have.text', 'aboard')
    cy.get('[data-testid="lesson-answer-comparison"]').should('contain', '你选了: aboard').and('contain', '答案：abroad')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1))
  })

  it('recommends the best next activity and completes an FSRS active-recall review', () => {
    cy.intercept('GET', '/api/english', { body: cards })
    cy.intercept('GET', '/api/english/speech', { body: { available: false } })
    cy.intercept('GET', '/api/learning/progress*', {
      body: { xp: 40, streak: 2, lastDay: '2026-11-08', completed: [0], timezone: 'UTC', weekly: [], legacyImported: true },
    })
    cy.intercept('GET', '/api/learning/plan*', {
      body: {
        profile: { dailyMinutes: 15, targetBand: 7.5, preferredModule: 'academic', timezone: 'UTC' },
        progress: { xp: 40, streak: 2, lastDay: '2026-11-08', completed: [0], timezone: 'UTC', weekly: [], legacyImported: true },
        nextActivity: {
          id: 'srs_review',
          kind: 'srs',
          title: 'Review 1 due vocabulary word in context',
          titleZh: '在语境中复习 1 个到期核心词',
          reason: '1 word from your lessons has reached its FSRS recall threshold.',
          reasonZh: '1 个词汇已到达 FSRS 最佳抗遗忘复习点。',
          cognitivePrinciple: 'Spaced Retrieval & Desirable Difficulty',
          cognitivePrincipleZh: '间隔重复与合意困难',
          estimatedMinutes: 2,
          ctaLabel: 'Start Spaced Recall',
          ctaLabelZh: '开始间隔复习',
          dueCount: 1,
        },
        dailySession: {
          targetMinutes: 15,
          completedMinutes: 4,
          steps: [
            { id: 'step-srs', kind: 'srs', stepNumber: 1, title: 'Spaced Recall (1 due)', titleZh: '间隔检索复习', subtitle: 'FSRS active recall', subtitleZh: '主动检索', minutes: 3, status: 'ready', dueCount: 1 },
            { id: 'step-vocab', kind: 'vocab_lesson', stepNumber: 2, title: 'Lesson 2', titleZh: '第 2 课', subtitle: '5 words in context', subtitleZh: '5 词精学', minutes: 4, status: 'completed', lessonIndex: 1 },
            { id: 'step-reading', kind: 'reading_daily', stepNumber: 3, title: '5-Question Reading', titleZh: '每日阅读', subtitle: 'Urban Heat', subtitleZh: '短文阅读', minutes: 5, status: 'ready' },
            { id: 'step-mistakes', kind: 'mistakes', stepNumber: 4, title: 'Mistake Remediation', titleZh: '错题重做', subtitle: 'Evidence check', subtitleZh: '证据核对', minutes: 3, status: 'completed', openMistakes: 0 },
          ],
        },
        srs: { dueNow: 1, totalTracked: 5, learningCount: 2, youngCount: 2, matureCount: 1, retention7d: 92.5, reviewsToday: 0 },
        proficiency: {
          sufficientEvidence: false,
          questionsAnswered: 5,
          estimatedBandRange: 'Calibrating (15+ questions needed)',
          cefrLevel: 'Calibrating',
          confidenceNote: 'You have answered 5 reading questions so far.',
          confidenceNoteZh: '目前已作答 5 道阅读题。',
        },
      },
    }).as('plan')
    cy.intercept('GET', '/api/learning/srs/due*', {
      body: [
        {
          cardId: 'abroad',
          word: 'abroad',
          pronunciation: '/əˈbrɔːd/',
          meaning: '在国外',
          mode: 'productive',
          prompt: 'Complete the sentence using the most precise vocabulary word:',
          promptZh: '结合语境完成句子：',
          contextSentence: 'I think working abroad really adds a new dimension to your CV.',
          blankedSentence: 'I think working ______ really adds a new dimension to your CV.',
          passageTitle: 'Global Mobility in Higher Education',
          options: ['aboard', 'abroad', 'absence', 'abandon'],
          answerIndex: 1,
          state: { cardId: 'abroad', stability: 2.6, difficulty: 5.0, reps: 1, lapses: 0, state: 'review', lastRating: 3, recognitionReps: 1, productiveReps: 0, dueAt: '2026-11-08T00:00:00Z' },
          retrievability: 0.9,
          intervals: { again: '15m', hard: '1d', good: '6d', easy: '9d' },
        },
      ],
    }).as('srsDue')
    cy.intercept('POST', '/api/learning/srs/review*', {
      body: {
        schedule: {
          next: { cardId: 'abroad', stability: 6.2, difficulty: 4.8, reps: 2, lapses: 0, state: 'review', lastRating: 3, recognitionReps: 1, productiveReps: 1, dueAt: '2026-11-14T00:00:00Z' },
          retrievability: 0.9,
          scheduledDays: 6.2,
          keepInReviewTab: true,
        },
        awardedXp: 5,
        progress: { xp: 45, streak: 2, lastDay: '2026-11-08', completed: [0], timezone: 'UTC', weekly: [], legacyImported: true },
      },
    }).as('srsSubmit')

    cy.visit('/english', {
      onBeforeLoad(win) {
        win.localStorage.setItem('projectdesk.locale', 'en')
      },
    })
    cy.wait('@plan')
    cy.get('[data-testid="best-next-activity-card"]').should('contain', 'Review 1 due vocabulary word in context')
    cy.get('[data-testid="best-next-activity-reason"]').should('contain', 'FSRS recall threshold')
    cy.get('[data-testid="start-best-next-activity"]').click()
    cy.wait('@srsDue')
    cy.get('[data-testid="srs-review-player"]').should('contain', 'I think working ______ really adds a new dimension to your CV.')
    cy.get('[data-testid="srs-option-1"]').click()
    cy.get('[data-testid="srs-feedback-panel"]').should('contain', 'Recalled accurately')
    cy.get('[data-testid="srs-rate-good"]').should('contain', '6d').click()
    cy.wait('@srsSubmit')
    cy.get('[data-testid="srs-review-complete"]').should('contain', 'Reviewed 1 vocabulary items')
  })
})
