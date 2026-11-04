import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import cypress from 'cypress'
import { loadEnv } from './load-env.mjs'

loadEnv()

// 0 passed, 1 a test failed, 2 Cypress or the runner could not run the suite,
// 3 the target URL did not answer. 143 means the pod was asked to stop.
const EXIT = { passed: 0, test: 1, infrastructure: 2, unreachable: 3, terminated: 143 }

const env = process.env
const startedAt = new Date()
const runId = env.E2E_RUN_ID ?? `${startedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-local`
const artifactsDir = path.resolve(env.E2E_ARTIFACTS_DIR ?? path.join('artifacts', runId))
const baseUrl = (env.E2E_BASE_URL ?? 'http://127.0.0.1:47291').replace(/\/+$/, '')
const browser = env.E2E_BROWSER || 'chrome'

const context = {
  runId,
  environment: env.E2E_ENVIRONMENT ?? 'local',
  job: env.E2E_JOB_NAME ?? null,
  pod: env.E2E_POD_NAME ?? null,
  namespace: env.E2E_NAMESPACE ?? null,
  image: env.E2E_IMAGE ?? null,
  baseUrl,
  browser,
  spec: env.E2E_SPEC || null,
  tags: env.E2E_TAGS || null,
  startedAt: startedAt.toISOString(),
}

let finished = false
process.exitCode = EXIT.infrastructure

async function finish(outcome) {
  if (finished) return
  finished = true
  const endedAt = new Date()
  const summary = {
    ...context,
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    totals: { tests: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
    failedTests: [],
    ...outcome,
  }
  summary.exitCode = EXIT[summary.failureType ?? 'passed']
  summary.status = summary.exitCode === 0 ? 'passed' : 'failed'

  try {
    await mkdir(artifactsDir, { recursive: true })
    await writeFile(path.join(artifactsDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  } catch (error) {
    console.error(`Could not write ${artifactsDir}/summary.json: ${error.message}`)
    if (summary.exitCode === 0) {
      summary.failureType = 'infrastructure'
      summary.exitCode = EXIT.infrastructure
      summary.status = 'failed'
      summary.message = 'Tests passed, but the result could not be saved with the artifacts.'
    }
  }

  const { totals } = summary
  console.log(
    `\nE2E ${summary.status.toUpperCase()}: ${totals.passed}/${totals.tests} passed, ` +
      `${totals.failed} failed, ${totals.pending} pending, ${totals.skipped} skipped ` +
      `in ${Math.round(summary.durationMs / 1000)}s (${summary.failureType ?? 'no failures'})`,
  )
  for (const test of summary.failedTests) {
    console.log(`  FAILED ${test.spec} > ${test.title}\n    ${test.error ?? ''}`)
  }
  if (summary.message) console.log(`  ${summary.message}`)
  console.log(`E2E_RESULT ${JSON.stringify({ ...summary, failedTests: summary.failedTests.length })}`)
  process.exitCode = summary.exitCode
}

process.on('SIGTERM', () => {
  finish({
    failureType: 'terminated',
    message: 'Received SIGTERM before Cypress finished (deadline, eviction, or manual stop).',
  }).finally(() => process.exit(EXIT.terminated))
})

// A certificate Node does not trust (for example an internal CA) still means
// the server answered. Cypress, not this check, decides how TLS is handled.
const TLS_TRUST_ERRORS = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
])

async function targetAnswers() {
  try {
    await fetch(baseUrl, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000) })
    return null
  } catch (error) {
    if (TLS_TRUST_ERRORS.has(error.cause?.code)) {
      console.log(`Note: Node does not trust the certificate for ${baseUrl} (${error.cause.code})`)
      return null
    }
    return error.cause?.message ?? error.message
  }
}

async function main() {
  console.log(`E2E run ${runId}: ${browser} against ${baseUrl}`)
  console.log(`Artifacts: ${artifactsDir}`)

  const unreachable = await targetAnswers()
  if (unreachable) {
    await finish({ failureType: 'unreachable', message: `${baseUrl} did not answer: ${unreachable}` })
    return
  }

  process.env.E2E_ARTIFACTS_DIR = artifactsDir
  const result = await cypress.run({
    browser,
    headless: true,
    spec: env.E2E_SPEC || undefined,
    config: { baseUrl },
  })

  if (result.status === 'failed') {
    await finish({ failureType: 'infrastructure', message: result.message })
    return
  }

  const failedTests = result.runs.flatMap((run) =>
    run.tests
      .filter((test) => test.state === 'failed')
      .map((test) => ({
        spec: run.spec.relative,
        title: test.title.join(' > '),
        error: test.displayError?.split('\n')[0] ?? run.error,
      })),
  )
  const totals = {
    tests: result.totalTests,
    passed: result.totalPassed,
    failed: result.totalFailed,
    pending: result.totalPending,
    skipped: result.totalSkipped,
  }

  let failureType = null
  let message
  if (totals.tests === 0) {
    failureType = 'infrastructure'
    message = 'No tests ran. Check E2E_SPEC and E2E_TAGS.'
  } else if (totals.failed > 0) {
    failureType = 'test'
  }

  await finish({
    failureType,
    message,
    totals,
    failedTests,
    cypressVersion: result.cypressVersion,
    browserVersion: `${result.browserName} ${result.browserVersion}`,
    screenshots: result.runs.reduce((count, run) => count + run.screenshots.length, 0),
    videos: result.runs.filter((run) => run.video).length,
  })
}

main().catch(async (error) => {
  if (finished) {
    console.error(error)
    process.exitCode = EXIT.infrastructure
    return
  }
  await finish({ failureType: 'infrastructure', message: error.stack ?? String(error) })
})
