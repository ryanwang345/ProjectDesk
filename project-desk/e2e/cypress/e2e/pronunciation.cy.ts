const preview = 'The weather looks lovely. Shall we go for a walk?'
const ukAudio = 'https://api.dictionaryapi.dev/media/pronunciations/en/abandon-uk.mp3'
const usAudio = 'https://api.dictionaryapi.dev/media/pronunciations/en/abandon-us.mp3'

function openEnglish({ neural = false, brokenRecording = false, blockedPlayback = false } = {}) {
  const played: HTMLAudioElement[] = []
  let blocked = blockedPlayback
  const cards = ['abandon', 'ability'].map((word) => ({ id: word, word, meaning: 'test meaning', examples: [`I use ${word} in a sentence.`], inReview: false, generated: false,
    pronunciation: '/əˈbæn.dən/', senses: [{ pos: 'v', en: 'a test word', zh: '测试' }], updatedAt: new Date().toISOString(),
    band: { collocations: [], writing: '', speaking: '', weak: '', fix: '', paraphrases: [], zh: '' } }))
  cy.intercept('GET', '/api/english', { body: cards })
  cy.intercept('GET', '/api/english/speech', { body: { available: neural } })
  cy.intercept('GET', 'https://commons.wikimedia.org/w/api.php*', { body: { query: { pages: {} } } })
  cy.intercept('GET', 'https://api.dictionaryapi.dev/api/v2/entries/en/*', { body: [{ phonetics: [usAudio, ukAudio].map((audio) => ({ audio,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Abandon.ogg', license: { name: 'BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' } })) }] }).as('dictionaryAudio')
  cy.visit('/english', { onBeforeLoad(win) {
    win.localStorage.setItem('projectdesk.locale', 'en')
    const voices = [
      { name: 'Daniel', lang: 'en-GB', localService: true, default: true },
      { name: 'Daniel (Enhanced)', lang: 'en-GB', localService: true, default: false },
      { name: 'Microsoft Jenny Online (Natural)', lang: 'en-US', localService: false, default: false },
      { name: 'Zarvox', lang: 'en-GB', localService: true, default: false },
    ] as SpeechSynthesisVoice[]
    cy.stub(win.speechSynthesis, 'getVoices').returns(voices)
    cy.stub(win.speechSynthesis, 'cancel')
    cy.stub(win.speechSynthesis, 'resume')
    cy.stub(win, 'SpeechSynthesisUtterance').callsFake((text: string) => ({ text }))
    cy.stub(win.speechSynthesis, 'speak').callsFake((utter: SpeechSynthesisUtterance) => {
      utter.onstart?.call(utter, new win.Event('start') as SpeechSynthesisEvent)
    }).as('deviceSpeak')
    cy.stub(win, 'Audio').callsFake((src: string) => {
      const audio = { src, playbackRate: 1, preservesPitch: false, onended: null, onerror: null,
        pause() {}, removeAttribute() {}, play: () => Promise.resolve(),
      } as unknown as HTMLAudioElement
      played.push(audio)
      cy.stub(audio, 'pause')
      cy.stub(audio, 'play').callsFake(() => {
        if (blocked) { blocked = false; return Promise.reject(new win.DOMException('Tap to play', 'NotAllowedError')) }
        if (brokenRecording && src.includes('dictionaryapi.dev')) return Promise.reject(new Error('Recording unavailable'))
        return Promise.resolve()
      })
      return audio
    })
  } })
  cy.get('[data-pronunciation="abandon"]').should('be.visible')
  return played
}

function settings() { cy.get('[aria-label="Pronunciation settings"]').click() }
function closeSettings() { cy.get('[data-testid="speech-settings"]').contains('button', 'Close').click() }
function pronounce(word: string) { cy.get(`[data-pronunciation="${word}"]`).find('button').click() }

describe('Natural English pronunciation', { tags: '@regression' }, () => {
  it('plays recordings before synthesis and retains their source and license', () => {
    const played = openEnglish()
    pronounce('abandon')
    cy.wait('@dictionaryAudio')
    cy.get('[data-pronunciation="abandon"]').should('contain', 'Recording · UK').and('contain', 'BY-SA 3.0')
    cy.then(() => { expect(played[0].src).to.eq(ukAudio); expect(played[0].playbackRate).to.eq(1) })
    cy.get('@deviceSpeak').should('not.have.been.called')
    cy.get('[data-pronunciation="abandon"] a').first().should('have.attr', 'href', 'https://commons.wikimedia.org/wiki/File:Abandon.ogg')
    pronounce('abandon')
    cy.get('[data-pronunciation="abandon"] button').should('have.attr', 'aria-pressed', 'false')
  })

  it('persists accent and speed and slows recordings without changing pitch', () => {
    const played = openEnglish()
    settings()
    cy.contains('button', 'American · US').click()
    cy.contains('button', 'Slow practice').click()
    closeSettings()
    pronounce('abandon')
    cy.get('[data-pronunciation="abandon"]').should('contain', 'Recording · US')
    cy.then(() => { expect(played[0].src).to.eq(usAudio); expect(played[0].playbackRate).to.eq(0.8); expect(played[0].preservesPitch).to.eq(true) })
    cy.reload()
    settings()
    cy.contains('button', 'American · US').should('have.attr', 'aria-pressed', 'true')
    cy.contains('button', 'Slow practice').should('have.attr', 'aria-pressed', 'true')
  })

  it('uses natural AI sentence speech, discloses its source and caches replays', () => {
    const played = openEnglish({ neural: true })
    let generations = 0
    cy.intercept('POST', '/api/english/speech', (req) => {
      generations++
      expect(req.body).to.deep.eq({ text: preview, accent: 'en-GB' })
      req.reply({ statusCode: 200, headers: { 'Content-Type': 'audio/wav' }, body: 'test audio bytes; playback is stubbed' })
    }).as('neuralSpeech')
    settings()
    cy.contains('button', 'British · UK').click()
    cy.get('[data-testid="speech-provider-status"]').should('contain', 'not a human recording')
    pronounce(preview)
    cy.wait('@neuralSpeech')
    cy.get(`[data-pronunciation="${preview}"]`).should('contain', 'AI voice · UK')
    cy.then(() => expect(played[0].src).to.match(/^blob:/))
    pronounce(preview)
    pronounce(preview)
    cy.get(`[data-pronunciation="${preview}"] button`).should('have.attr', 'aria-pressed', 'true')
    cy.then(() => expect(generations).to.eq(1))
    cy.get('@deviceSpeak').should('not.have.been.called')
    cy.screenshot('pronunciation-settings', { capture: 'viewport' })
  })

  it('selects an enhanced English voice when a recording cannot play', () => {
    openEnglish({ brokenRecording: true })
    settings()
    cy.contains('button', 'British · UK').click()
    closeSettings()
    pronounce('abandon')
    cy.get('@deviceSpeak').should('have.been.calledOnce').its('firstCall.args.0.voice.name').should('eq', 'Daniel (Enhanced)')
    cy.get('[data-pronunciation="abandon"]').should('contain', 'Device voice · UK')
  })

  it('recovers the original licensed MP3 when the dictionary mirror fails', () => {
    const played = openEnglish({ brokenRecording: true })
    const original = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/dd/En-us-abandon.ogg/En-us-abandon.ogg.mp3'
    cy.intercept('GET', 'https://commons.wikimedia.org/w/api.php*', { body: { query: { pages: { 1755007: { videoinfo: [{ derivatives: [{ type: 'audio/mpeg', src: original }] }] } } } } }).as('originalRecording')
    pronounce('abandon')
    cy.wait('@originalRecording')
    cy.get('[data-pronunciation="abandon"]').should('contain', 'Recording').and('contain', 'BY-SA 3.0')
    cy.then(() => expect(played[1].src).to.eq(original))
    cy.get('@deviceSpeak').should('not.have.been.called')
  })

  it('prefers a natural device voice in automatic mode and recovers from a speech outage', () => {
    openEnglish({ neural: true })
    cy.intercept('POST', '/api/english/speech', { statusCode: 503, body: { error: 'Speech temporarily unavailable' } }).as('speechFailure')
    settings()
    pronounce(preview)
    cy.wait('@speechFailure')
    cy.get('@deviceSpeak').should('have.been.calledOnce').its('firstCall.args.0.voice.name').should('eq', 'Microsoft Jenny Online (Natural)')
    cy.get(`[data-pronunciation="${preview}"]`).should('contain', 'Device voice · US')
  })

  it('prevents overlapping playback and supports an extra tap when autoplay is blocked', () => {
    const played = openEnglish({ blockedPlayback: true })
    pronounce('abandon')
    cy.get('[data-pronunciation="abandon"]').should('contain', 'Tap to play')
    pronounce('abandon')
    cy.get('[data-pronunciation="abandon"]').should('contain', 'Recording')
    pronounce('ability')
    cy.get('[data-pronunciation="ability"]').should('contain', 'Recording')
    cy.then(() => { expect(played).to.have.length(3); expect(played[1].pause).to.have.been.calledOnce })
    cy.get('[data-pronunciation="abandon"] button').should('have.attr', 'aria-pressed', 'false')
  })
})
