# Pronunciation audio

All word, phrase and example-sentence speaker buttons use the same player.
The audio-wave button in the English header opens pronunciation settings with
an accent choice, natural or slower playback, and a sentence preview. Preferences
are remembered in the browser. The default Automatic setting prioritizes an
available word recording in either English accent.

## Audio sources

1. Single words first use pronunciation recordings from the
   [Free Dictionary API](https://dictionaryapi.dev/). The player prefers a British
   recording in Automatic mode, then another available English recording. Explicit
   British or American selections only use a matching recording. The source and
   license returned with each recording appear beside the played word.
   If the dictionary audio mirror fails and the source is Wikimedia Commons,
   the player retrieves the original recording's MP3 derivative through the
   [Commons media API](https://www.mediawiki.org/wiki/Extension:TimedMediaHandler/API)
   before falling back to synthetic speech.
2. Sentences, phrases and missing recordings use generated audio when a speech
   provider is available. This is visibly labeled **AI voice**. The backend uses
   [audio in Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions)
   with `gpt-audio-1.5` and `marin`, requesting native English rhythm, connected
   speech and accurate stress. It checks the returned audio transcript against
   the requested text, allowing punctuation/case changes but rejecting added
   words and paraphrases. British/American accent instructions are applied; an
   Automatic request uses British English for generated speech.
3. If recordings or generated audio are unavailable, the player chooses the best
   available English device voice. Natural, neural, premium and enhanced voices
   outrank compact voices; novelty/effect voices are excluded. Device voice
   availability and quality depend on the browser and operating system.

The settings dialog reports whether generated sentence audio is configured.
Device-generated speech is labeled **Device voice**, never as a human recording.
Slower playback is 0.8× and preserves pitch; natural playback is 1×.

## Enable generated sentence audio

The API can reuse an encrypted OpenAI provider credential already stored in the
app. Its endpoint must be exactly `https://api.openai.com/v1`, or empty for the
default OpenAI endpoint. It does not reuse another vendor's text-model credential.

Alternatively, set `PROJECT_DESK_SPEECH_API_KEY` on the API service. Direct local
execution also accepts `OPENAI_API_KEY` for the official OpenAI endpoint. Docker
Compose forwards the dedicated speech variable. Optional configuration:

| Variable | Default |
| --- | --- |
| `PROJECT_DESK_SPEECH_BASE_URL` | `https://api.openai.com/v1` |
| `PROJECT_DESK_SPEECH_MODEL` | `gpt-audio-1.5` |
| `PROJECT_DESK_SPEECH_VOICE` | `marin` |

A custom endpoint must implement audio Chat Completions and have an explicit
`PROJECT_DESK_SPEECH_API_KEY`. Provider keys stay on the server. No audio is
generated until a learner presses a speaker button; generated audio uses the
provider account's API billing.

This implementation avoids the legacy `/audio/speech` models scheduled to shut
down in January 2027, using the documented bounded audio Chat Completions flow.
See [OpenAI's deprecation notice](https://developers.openai.com/api/docs/deprecations).

## Playback and caching

- Starting another clip cancels pending lookups, stops previous audio, and ignores
  stale responses. The speaker button changes to a stop control during playback.
- Loading, failure and tap-to-play states are visible. Browsers that block the
  first asynchronous playback can play the prepared audio with another tap.
- The browser holds at most 48 clips and 12 MiB of generated audio; evicted object
  URLs are revoked. The server holds at most 128 clips and 32 MiB for up to 24 hours.
  Audio is keyed by text, accent, model, voice and provider credential. Simultaneous
  requests for the same clip share one generation. Replay does not generate a
  fresh paid request while the clip remains cached.
- Network waits, text length, response sizes and simultaneous generation are
  bounded. Provider errors never return upstream bodies or credentials.

## Verification

`go test -mod=vendor ./...` checks server input limits, WAV output, transcript
matching, concurrent deduplication, replay caching, separate accent caches,
unconfigured fallback and credential boundaries. Run the speech tests with
`-race` to check concurrent access.

The Cypress spec `e2e/cypress/e2e/pronunciation.cy.ts` checks source selection,
preference persistence, pitch-preserving speed, neural replay caching, device
fallback, autoplay recovery and stopping previous clips. Browser tests stub audio
playback and provider responses; they do not assess voice quality by listening
or make billed speech requests.
