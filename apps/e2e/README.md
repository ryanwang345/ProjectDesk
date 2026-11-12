# Project Desk end-to-end tests

Cypress tests for the deployed Project Desk app. They run on your machine, in Jenkins checks, and as a Kubernetes CronJob in the `rwang` namespace once an hour.

This folder is its own npm package. The web image never downloads Cypress, and `project-desk/.dockerignore` excludes this folder from the web build.

## How a run works

1. `docker/entrypoint.sh` creates `/artifacts/<UTC timestamp>-<job name>/` and copies all output into `run.log` in that folder.
2. `scripts/run.mjs` checks that the base URL answers. It then runs Cypress through the module API in headless Chrome and writes `summary.json`.
3. `scripts/publish.mjs` uploads the run folder to S3 when a bucket is set, and pushes metrics when a Pushgateway URL is set. It also deletes run folders beyond the newest `E2E_KEEP_RUNS`. A failure in any of these steps is logged and does not change the exit code.
4. The pod exits with the Cypress result.

| Exit code | `failureType` | Meaning |
| --- | --- | --- |
| 0 | none | Every test passed |
| 1 | `test` | At least one test failed |
| 2 | `infrastructure` | Cypress could not run, no tests matched, or results could not be saved |
| 3 | `unreachable` | The base URL did not answer (DNS, connection refused, timeout) |
| 143 | `terminated` | The pod got SIGTERM, from the active deadline, an eviction, or a manual stop |

Every exit code except 0 marks the Job as failed. The last line of each log starts with `E2E_RESULT` and holds the summary as one line of JSON: job, pod, namespace, environment, image, timestamps, duration, totals, failed tests, and exit code.

The target desk holds real projects. The cards spec only creates projects named `[cypress-e2e] ...` and only deletes projects with that prefix. It never uses "Clear desk". Cards left by a killed run are removed by the next run once they are an hour old.

| Spec | Tag | What it does |
| --- | --- | --- |
| `cypress/e2e/smoke.cy.ts` | `@smoke` | Read only: nginx and API health, desk, about page, 404 page |
| `cypress/e2e/projects.cy.ts` | `@regression` | Validates the form, then adds, edits, moves, and removes one card |
| `cypress/e2e/reading.cy.ts` | `@regression` | Reading library and existing practice/exam flows; session writes require the flag below |
| `cypress/e2e/reading-learning.cy.ts` | `@regression` | Dashboard order, mobile/keyboard navigation, load recovery, daily persistence, rewards, mistakes and passage vocabulary |
| `cypress/e2e/lesson-feedback.cy.ts` | `@regression` | Isolated lesson fixtures: selected answers, corrections, heart counts, capitalization, and Chinese mobile feedback; no learner data writes |
| `cypress/e2e/world-vocabulary.cy.ts` | `@regression` | Authored world-topic vocabulary, bilingual search, saved totals, examples, and mobile layout; no learner data writes |

Reading session write tests are disabled unless `E2E_ALLOW_LEARNING_WRITES=true`.
Use that flag only against a fresh disposable application database: these tests
create real learning activity and XP, and the daily test requires an uncompleted
daily challenge. Do not enable it in recurring deployed checks. Read-only Reading
checks still run by default. See [Reading learning](../docs/reading-learning.md)
for the database integration tests and isolated-port setup.

## Run locally

Start the app with Docker Compose from `project-desk` (`docker compose up --build`), then:

```bash
cd project-desk/e2e
npm install
npm run e2e
npm run e2e:smoke
npm run cypress:open
```

`npm run e2e`, `npm run cypress:open`, and `npx cypress run` read `.env` in this folder. Change `E2E_BASE_URL` there to point at another desk. A variable already set in the shell wins over the file. Set `E2E_ENV_FILE` to read a different file.

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://127.0.0.1:47291` | App under test |
| `E2E_BROWSER` | `chrome` | Any browser Cypress finds (`chrome`, `electron`, `firefox`, `edge`) |
| `E2E_SPEC` | all | Comma-separated spec paths |
| `E2E_TAGS` | all | `@cypress/grep` tags: `@smoke`, `@smoke @regression` (either), `@smoke+@regression` (both) |
| `E2E_RETRIES` | `1` | Retries per failed test in run mode |
| `E2E_VIDEO` | `false` | `true` records an mp4 per spec |
| `E2E_ALLOW_LEARNING_WRITES` | `false` | Enable Reading session/reward tests in a fresh disposable workspace only |
| `E2E_ENVIRONMENT` | `local` | Name used in summaries, S3 keys, and metrics |
| `E2E_ARTIFACTS_DIR` | `artifacts/<run id>` | Where JUnit, screenshots, videos, and `summary.json` go |

Results land in `artifacts/<run id>/`: `junit/*.xml`, `screenshots/` (failed tests only, one per attempt), `videos/`, and `summary.json`.

Checks before committing:

```bash
npm run typecheck
(cd .. && npm run lint)
```

## Build the image

```bash
cd project-desk/e2e
docker build --platform linux/amd64 -t project-desk-e2e:local .
docker run --rm --user 10001 --read-only --tmpfs /tmp:exec --shm-size 512m \
  --cap-drop ALL --security-opt no-new-privileges \
  -v e2e-artifacts:/artifacts \
  -v "$PWD/.env:/e2e/.env:ro" \
  project-desk-e2e:local
```

The image is based on `cypress/browsers` with Node 24 and Chrome 156. `npm ci` installs the exact versions from `package-lock.json`, and `cypress verify` runs during the build. The image runs as uid 10001 under `tini`, and its home directory is `/tmp/home`. Only `/tmp`, `/dev/shm`, and `/artifacts` need to be writable. The cluster nodes are amd64, so build with `--platform linux/amd64`.

## Deploy with Helm

The chart is in `chart/`. Run settings (URL, browser, tags, retries, S3, Pushgateway) are read from `.env`. `values.yaml` holds the schedule, resources, and image, and each environment has its own file:

| File | State |
| --- | --- |
| `values-dev.yaml` | `rwang` namespace. The URL is `E2E_BASE_URL` in `.env` |
| `values-staging.yaml` | Disabled; no staging deployment exists yet |
| `values-prod.yaml` | Disabled; needs approval and a URL. Runs `@smoke` only every 15 minutes |

The chart renders nothing until `image.tag` is set. Dev uses `latest`. Each run pulls that tag because `image.pullPolicy` is `Always`.

```bash
cd project-desk/e2e
helm lint ./chart -f chart/values-dev.yaml --set image.tag=42 --set-file dotenv=.env
helm template project-desk-e2e ./chart -n rwang -f chart/values-dev.yaml --set image.tag=42 --set-file dotenv=.env
helmfile -e dev apply
```

`helmfile` passes `.env` into the chart. The release creates a ServiceAccount with no API token, a ConfigMap whose contents are that file mounted at `/e2e/.env`, a 1Gi artifacts claim that `helm uninstall` keeps, and the CronJob. The claim is the third in the namespace and brings storage requests to 3Gi of the 5Gi quota.

Credentials never go in values. Put them in a Secret and set `existingSecret` to its name. All of its keys become environment variables, for example `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for S3. For workload identity, add the role annotation under `serviceAccount.annotations`. The AWS SDK reads web identity credentials by itself.

## Change the schedule

Set `cronjob.schedule` in the environment values file, for example `"*/15 * * * *"`. Set `cronjob.timeZone` (for example `America/Los_Angeles`) to read the schedule in that zone instead of the controller's. `cronjob.suspend: true` pauses runs without removing anything. Other settings:

- `cronjob.activeDeadlineSeconds` (900): when a run takes longer, it gets SIGTERM and has `terminationGracePeriodSeconds` (60) to save its result and artifacts.
- `cronjob.successfulJobsHistoryLimit` and `cronjob.failedJobsHistoryLimit` are both 1, so the namespace keeps only the latest finished run of each outcome.
- `cronjob.concurrencyPolicy: Forbid`: a scheduled run is skipped while the previous one is still going.
- `cronjob.backoffLimit: 0` and `restartPolicy: Never`: a failed run is not retried. Cypress retries individual tests instead (`cypress.retries`).
- `resources`: 500m CPU / 1Gi requested, 1 CPU / 3Gi limit. `/dev/shm` is a 512Mi memory-backed volume that counts toward that limit.

## Run it now

```bash
kubectl create job -n rwang --from=cronjob/project-desk-e2e project-desk-e2e-$(date +%s)
```

## Logs and failed Jobs

```bash
kubectl get cronjob,jobs -n rwang -l app.kubernetes.io/name=project-desk-e2e
kubectl logs -n rwang job/<job name>
kubectl logs -n rwang job/<job name> | grep '^E2E_RESULT' | cut -d' ' -f2- | jq .
kubectl describe job -n rwang <job name>
```

Kubernetes keeps the last 3 successful and the last 5 failed Jobs with their pods, so their logs stay readable. `describe` shows `DeadlineExceeded` when the active deadline stopped a run.

## Artifacts

Each run writes `summary.json`, `run.log`, `junit/*.xml`, failure screenshots, and videos (when `E2E_VIDEO=true` in `.env`) to its own folder on the `project-desk-e2e-artifacts` claim. The newest `E2E_KEEP_RUNS` runs are kept. To read them:

```bash
kubectl run -n rwang e2e-artifacts --rm -i --restart=Never --image=busybox:1.37 \
  --overrides='{"spec":{"securityContext":{"runAsUser":10001,"runAsGroup":10001},"containers":[{"name":"e2e-artifacts","image":"busybox:1.37","command":["ls","-lR","/artifacts"],"resources":{"requests":{"cpu":"50m","memory":"32Mi"},"limits":{"memory":"64Mi"}},"volumeMounts":[{"name":"a","mountPath":"/artifacts"}]}],"volumes":[{"name":"a","persistentVolumeClaim":{"claimName":"project-desk-e2e-artifacts"}}]}}'
```

The claim is ReadWriteOnce, so run this between scheduled runs. To copy files out, start the same pod with `"command":["sleep","300"]` and no `--rm`, then use `kubectl cp -n rwang e2e-artifacts:/artifacts ./e2e-artifacts` and delete the pod.

For S3 or an S3-compatible store, set `E2E_S3_BUCKET` in `.env`, plus `E2E_S3_ENDPOINT` for an S3-compatible store. `AWS_REGION` can be set in the same file. Each run uploads to `s3://<bucket>/<prefix>/<environment>/<run id>/`, and every object carries the job, namespace, environment, and result as metadata.

## Monitoring

No Prometheus, Pushgateway, Grafana, or Teams integration exists in this repository or the `rwang` namespace, so none is set up here. Every run prints `E2E_RESULT` JSON to the pod log. The namespace carries the label `logging.vailsys.com/elasticsearch=true`, so if that log shipping is active, the line is searchable there with the rest of the pod output. To also push metrics, set `E2E_PUSHGATEWAY_URL` in `.env`. Each run then replaces the group `job=project_desk_e2e, environment=<env>` with:

- `project_desk_e2e_tests{result="total|passed|failed|pending|skipped"}`
- `project_desk_e2e_duration_seconds`
- `project_desk_e2e_success` (1 or 0)
- `project_desk_e2e_failure{type="test|infrastructure|unreachable|terminated"}`
- `project_desk_e2e_last_run_timestamp_seconds`
- `project_desk_e2e_run_info{run_id, job_name, namespace}`

Alert on `project_desk_e2e_failure{type="test"} == 1` for broken app behavior. Use the `infrastructure`, `unreachable`, and `terminated` series for runner or cluster problems.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Exit 3, `did not answer` | DNS or ingress is down, or the pod cannot reach `E2E_BASE_URL` in `.env`. `curl` the URL from another pod in the namespace. |
| Exit 2, `No tests ran` | `E2E_TAGS` or `E2E_SPEC` in `.env` matches nothing. |
| Exit 2, `Could not find Cypress test run results` or Electron `SIGTRAP` | Cypress crashed while starting. Check that `HOME` is under `/tmp` and that `/tmp` and `/dev/shm` are writable. |
| `Cannot create /artifacts/...` | The artifacts volume is not writable by uid 10001. Keep `podSecurityContext.fsGroup: 10001`. |
| Chrome crashes mid-run, or the pod is `OOMKilled` | Raise `resources.limits.memory` or `shmSizeLimit`. Both count toward the namespace `limits.memory` quota of 8Gi. |
| Pod never starts, `exceeded quota` | The namespace quota (4 CPU and 8Gi requested) is full. |
| `ImagePullBackOff` | The tag was not pushed, or the Docker Hub repository `rwang345/project-desk-e2e` is private. The namespace cannot hold a pull secret, so keep it public. |
| No new Jobs appear | `cronjob.suspend` is true, or the previous run is still going (`Forbid`). |
| Helm says `image.tag is required` | Jenkins has not built the image yet. Set the tag of a pushed build in `values-dev.yaml`. |

## Jenkins

The root `Jenkinsfile` adds three steps to the existing pipeline:

- **Check, E2E:** installs the package without the Cypress binary, typechecks the config and specs (including the Cypress config types), and runs `helm lint` for all three environments plus `helm template` for dev. The existing Web stage's `npm run lint` already covers these files.
- **Push images:** Kaniko builds `docker.io/<user>/project-desk-e2e:<build number>`. On `main` it also pushes `:latest`, which is what the dev CronJob pulls.
- **Record image tag:** on `main`, when the secret-text credential `project-desk-github-token` is available, the web and API build number is committed with `[skip ci]`. The e2e chart stays on `latest`.

Deploy the CronJob with `helmfile -e dev apply` from this folder. There is no Argo CD Application for these tests.
