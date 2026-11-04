import { readdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { loadEnv } from './load-env.mjs'

loadEnv()

const env = process.env
const artifactsDir = path.resolve(env.E2E_ARTIFACTS_DIR ?? '')

const CONTENT_TYPES = {
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.log': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
}

async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? filesUnder(full) : [full]
    }),
  )
  return nested.flat()
}

async function uploadToS3(summary) {
  const bucket = env.E2E_S3_BUCKET
  if (!bucket) return
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const endpoint = env.E2E_S3_ENDPOINT || undefined
  const client = new S3Client({
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1',
    endpoint,
    forcePathStyle: Boolean(endpoint),
  })
  const prefix = [env.E2E_S3_PREFIX || 'project-desk-e2e', summary.environment, summary.runId]
    .filter(Boolean)
    .join('/')

  const files = await filesUnder(artifactsDir)
  for (const file of files) {
    const key = `${prefix}/${path.relative(artifactsDir, file).split(path.sep).join('/')}`
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readFile(file),
        ContentType: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        Metadata: {
          job: summary.job ?? '',
          namespace: summary.namespace ?? '',
          environment: summary.environment,
          status: summary.status,
          'failure-type': summary.failureType ?? 'none',
        },
      }),
    )
  }
  console.log(`Uploaded ${files.length} artifact files to s3://${bucket}/${prefix}/`)
}

function label(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
}

async function pushMetrics(summary) {
  const gateway = env.E2E_PUSHGATEWAY_URL
  if (!gateway) return
  const { totals } = summary
  const failureType = summary.failureType ?? 'none'
  const lines = [
    '# TYPE project_desk_e2e_tests gauge',
    ...['passed', 'failed', 'pending', 'skipped'].map(
      (result) => `project_desk_e2e_tests{result="${result}"} ${totals[result]}`,
    ),
    `project_desk_e2e_tests{result="total"} ${totals.tests}`,
    '# TYPE project_desk_e2e_duration_seconds gauge',
    `project_desk_e2e_duration_seconds ${summary.durationMs / 1000}`,
    '# TYPE project_desk_e2e_success gauge',
    `project_desk_e2e_success ${summary.status === 'passed' ? 1 : 0}`,
    '# TYPE project_desk_e2e_failure gauge',
    ...['test', 'infrastructure', 'unreachable', 'terminated'].map(
      (type) => `project_desk_e2e_failure{type="${type}"} ${failureType === type ? 1 : 0}`,
    ),
    '# TYPE project_desk_e2e_last_run_timestamp_seconds gauge',
    `project_desk_e2e_last_run_timestamp_seconds ${Math.floor(Date.parse(summary.endedAt) / 1000)}`,
    '# TYPE project_desk_e2e_run_info gauge',
    `project_desk_e2e_run_info{run_id="${label(summary.runId)}",job_name="${label(summary.job)}",namespace="${label(summary.namespace)}"} 1`,
  ]
  const url = `${gateway.replace(/\/+$/, '')}/metrics/job/project_desk_e2e/environment/${encodeURIComponent(summary.environment)}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain; version=0.0.4' },
    body: `${lines.join('\n')}\n`,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Pushgateway answered ${response.status}`)
  console.log(`Pushed metrics to ${url}`)
}

async function pruneOldRuns() {
  const keep = Number(env.E2E_KEEP_RUNS ?? 0)
  if (!Number.isInteger(keep) || keep <= 0) return
  const root = path.dirname(artifactsDir)
  const runs = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) runs.push(entry.name)
  }
  // Run directories start with a UTC timestamp, so name order is age order.
  const old = runs.filter((name) => /^\d{8}T\d{6}Z/.test(name)).sort().slice(0, -keep)
  for (const name of old) {
    await rm(path.join(root, name), { recursive: true, force: true })
  }
  if (old.length) console.log(`Removed ${old.length} artifact runs older than the newest ${keep}`)
}

async function step(name, action) {
  try {
    await action()
  } catch (error) {
    console.error(`Artifact ${name} failed: ${error.message}`)
  }
}

async function main() {
  if (!env.E2E_ARTIFACTS_DIR || !(await stat(artifactsDir).catch(() => null))) {
    console.error('E2E_ARTIFACTS_DIR is not set or does not exist; nothing to publish')
    return
  }
  const summary = JSON.parse(await readFile(path.join(artifactsDir, 'summary.json'), 'utf8'))
  await step('upload', () => uploadToS3(summary))
  await step('metrics push', () => pushMetrics(summary))
  await step('pruning', pruneOldRuns)
}

main().catch((error) => console.error(`Artifact publishing failed: ${error.message}`))
