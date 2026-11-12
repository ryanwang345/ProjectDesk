pipeline {
  agent {
    kubernetes {
      cloud 'local-k8s'
      defaultContainer 'node'
      yaml '''
apiVersion: v1
kind: Pod
spec:
  shareProcessNamespace: false
  securityContext:
    fsGroup: 1000
  containers:
    - name: node
      image: node:22-bookworm
      command: ['cat']
      tty: true
      resources:
        requests:
          memory: 256Mi
          cpu: 100m
        limits:
          memory: 2Gi

    - name: golang
      image: golang:1.22-bookworm
      command: ['cat']
      tty: true
      resources:
        requests:
          memory: 128Mi
          cpu: 100m

    - name: helm
      image: alpine/helm:4.3.1
      command: ['cat']
      tty: true
      resources:
        requests:
          memory: 64Mi
          cpu: 50m

    - name: buildkit
      image: moby/buildkit:v0.34.2-rootless
      command: ['cat']
      tty: true
      env:
        # Each invocation starts a temporary daemon inside this container.
        # Native snapshots avoid requiring /dev/fuse or overlayfs support.
        - name: BUILDKITD_FLAGS
          value: --oci-worker-no-process-sandbox --oci-worker-snapshotter=native
      resources:
        requests:
          memory: 512Mi
          cpu: 200m
        limits:
          memory: 3Gi
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        # Required by rootless BuildKit's user namespaces and mounts.
        seccompProfile:
          type: Unconfined
        appArmorProfile:
          type: Unconfined
      volumeMounts:
        - name: buildkit-state
          mountPath: /home/user/.local/share/buildkit
  volumes:
    - name: buildkit-state
      emptyDir: {}
'''
    }
  }

  // The VM Jenkins is not reachable by GitHub webhooks, so poll for new
  // commits. CI's own "[skip ci]" tag commits skip every stage.
  triggers {
    pollSCM('H/2 * * * *')
  }

  parameters {
    choice(
      name: 'COMPONENT',
      choices: ['auto', 'web', 'api', 'web+api', 'all', 'e2e'],
      description: 'Select component to build & push. "auto" detects git diff changes. Selecting a specific component forces build & push even if commit has [skip ci].'
    )
    booleanParam(
      name: 'SKIP_E2E',
      defaultValue: true,
      description: 'Skip E2E container build and tests to save disk space (recommended)'
    )
  }

  environment {
    COMPONENT = "${params.COMPONENT ?: 'auto'}"
    SKIP_E2E = "${params.SKIP_E2E == null ? true : params.SKIP_E2E}"
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Detect Changes') {
      steps {
        container('jnlp') {
          sh '''
            set +x
            set -eu
            cd "$WORKSPACE"

            # Clean up marker files from previous builds
            rm -f .ci-build-*

            g() {
              git -c safe.directory="$WORKSPACE" "$@"
            }

            COMMIT_MSG="$(g log -1 --pretty=%B)"
            echo "Current commit: $(g rev-parse --short HEAD)"
            echo "Commit message: ${COMMIT_MSG}"
            echo "Selected component: ${COMPONENT:-auto}"

            # 1. Custom component selection from Jenkins UI (overrides [skip ci])
            if [ "${COMPONENT:-auto}" = "web" ]; then
              echo "[CI] Custom selection: WEB ONLY (ignoring [skip ci])"
              touch .ci-build-web .ci-build-any
            elif [ "${COMPONENT:-auto}" = "api" ]; then
              echo "[CI] Custom selection: API ONLY (ignoring [skip ci])"
              touch .ci-build-api .ci-build-any
            elif [ "${COMPONENT:-auto}" = "web+api" ]; then
              echo "[CI] Custom selection: WEB + API (ignoring [skip ci])"
              touch .ci-build-web .ci-build-api .ci-build-any
            elif [ "${COMPONENT:-auto}" = "e2e" ]; then
              echo "[CI] Custom selection: E2E ONLY (ignoring [skip ci])"
              touch .ci-build-e2e .ci-build-any
            elif [ "${COMPONENT:-auto}" = "all" ]; then
              echo "[CI] Custom selection: ALL COMPONENTS (ignoring [skip ci])"
              touch .ci-build-web .ci-build-api .ci-build-e2e .ci-build-helm .ci-build-any
            else
              # 2. AUTO mode: check for [skip ci] first
              if echo "$COMMIT_MSG" | grep -q '\\[skip ci\\]'; then
                echo "[CI] [skip ci] detected in commit message. Skipping build."
                exit 0
              fi

              # Check commit message flags
              if echo "$COMMIT_MSG" | grep -qiE '\\[(force build|build all)\\]'; then
                echo "[CI] Force build ALL requested via commit tag."
                touch .ci-build-web .ci-build-api .ci-build-e2e .ci-build-helm .ci-build-any
                exit 0
              fi

              if echo "$COMMIT_MSG" | grep -qi '\\[build web\\]'; then
                echo "[CI] Force build WEB requested via commit tag."
                touch .ci-build-web .ci-build-any
              fi

              if echo "$COMMIT_MSG" | grep -qi '\\[build api\\]'; then
                echo "[CI] Force build API requested via commit tag."
                touch .ci-build-api .ci-build-any
              fi

              if echo "$COMMIT_MSG" | grep -qi '\\[build e2e\\]'; then
                echo "[CI] Force build E2E requested via commit tag."
                touch .ci-build-e2e .ci-build-any
              fi
            fi

            # Determine base commit to diff against
            HEAD_SHA="$(g rev-parse HEAD)"
            BASE_COMMIT=""
            if [ -n "${GIT_PREVIOUS_SUCCESSFUL_COMMIT:-}" ] && [ "${GIT_PREVIOUS_SUCCESSFUL_COMMIT}" != "$HEAD_SHA" ] && g cat-file -e "${GIT_PREVIOUS_SUCCESSFUL_COMMIT}^{commit}" 2>/dev/null; then
              BASE_COMMIT="$GIT_PREVIOUS_SUCCESSFUL_COMMIT"
              echo "[CI] Comparing against previous successful commit: ${BASE_COMMIT}"
            elif [ -n "${GIT_PREVIOUS_COMMIT:-}" ] && [ "${GIT_PREVIOUS_COMMIT}" != "$HEAD_SHA" ] && g cat-file -e "${GIT_PREVIOUS_COMMIT}^{commit}" 2>/dev/null; then
              BASE_COMMIT="$GIT_PREVIOUS_COMMIT"
              echo "[CI] Comparing against previous build commit: ${BASE_COMMIT}"
            elif g rev-parse --verify HEAD~1 >/dev/null 2>&1; then
              BASE_COMMIT="HEAD~1"
              echo "[CI] Comparing against HEAD~1 (rebuild or re-triggered commit detected)"
            fi

            if [ -z "$BASE_COMMIT" ]; then
              if [ ! -f .ci-build-any ]; then
                echo "[CI] No base commit found (initial build). Marking all components for build."
                touch .ci-build-web .ci-build-api .ci-build-e2e .ci-build-helm .ci-build-any
              fi
              exit 0
            fi

            CHANGED_FILES="$(g diff --name-only "$BASE_COMMIT" HEAD || true)"
            echo "========================================"
            echo "[CI] Changed files since ${BASE_COMMIT}:"
            if [ -z "$CHANGED_FILES" ]; then
              echo "  (none)"
            else
              echo "$CHANGED_FILES" | sed 's/^/  /'
            fi
            echo "========================================"

            # Filter out documentation, markdown, diagrams, and assets from triggering container builds
            CODE_CHANGED_FILES="$(echo "$CHANGED_FILES" | grep -v -E '[.](md|markdown|mmd|svg|png|jpg|jpeg|gif)$' || true)"

            # Exercise builders when the pipeline itself changes.
            # Rebuild Web and API by default; skip E2E unless explicitly requested to prevent node disk exhaustion.
            if echo "$CHANGED_FILES" | grep -q '^Jenkinsfile$'; then
              echo "[CI] -> Detected pipeline changes"
              touch .ci-build-web .ci-build-api .ci-build-helm .ci-build-any
            fi

            # 1. API: changes under apps/api/ (or legacy project-desk/server/)
            if echo "$CODE_CHANGED_FILES" | grep -q -E '^(apps/api/|project-desk/server/)'; then
              echo "[CI] -> Detected API changes"
              touch .ci-build-api .ci-build-any
            fi

            # 2. E2E: code changes under apps/e2e/ (excluding docs/assets)
            if echo "$CODE_CHANGED_FILES" | grep -q -E '^(apps/e2e/|project-desk/e2e/)'; then
              echo "[CI] -> Detected E2E changes"
              touch .ci-build-e2e .ci-build-any
            fi

            # 3. Helm: chart structural/template changes (ignore pure values.yaml image tag updates)
            if echo "$CHANGED_FILES" | grep -E '^(deploy/helm/|project-desk/chart/)' | grep -v -E 'values[.]ya?ml$' | grep -q .; then
              echo "[CI] -> Detected Helm chart changes"
              touch .ci-build-helm
            fi

            # 4. Web: changes under apps/web/
            if echo "$CODE_CHANGED_FILES" | grep -q -E '^apps/web/'; then
              echo "[CI] -> Detected Web frontend changes"
              touch .ci-build-web .ci-build-any
            fi

            # Allow explicitly skipping E2E to save ephemeral disk space
            if [ "${SKIP_E2E:-false}" = "true" ] || echo "$COMMIT_MSG" | grep -qiE '\\[(skip e2e|no e2e)\\]'; then
              echo "[CI] Skip E2E requested. Removing E2E build flags."
              rm -f .ci-build-e2e
            fi

            if [ ! -f .ci-build-any ] && [ ! -f .ci-build-helm ]; then
              echo "[CI] No relevant monorepo changes detected."
              echo "[CI] Skipping all test stages, Docker builds, and image pushes."
            else
              echo "[CI] Execution plan:"
              [ -f .ci-build-web ] && echo "  - Web: BUILD & TEST" || echo "  - Web: SKIP"
              [ -f .ci-build-api ] && echo "  - API: BUILD & TEST" || echo "  - API: SKIP"
              [ -f .ci-build-e2e ] && echo "  - E2E: BUILD & TEST" || echo "  - E2E: SKIP"
              [ -f .ci-build-helm ] && echo "  - Helm: LINT" || echo "  - Helm: SKIP"
            fi
          '''
        }
      }
    }

    stage('Install Dependencies') {
      when {
        expression { return fileExists('.ci-build-web') || fileExists('.ci-build-e2e') }
      }
      steps {
        container('node') {
          sh '''
            if [ -f "$WORKSPACE/.ci-build-web" ]; then
              echo "[CI] Installing web dependencies..."
              cd "$WORKSPACE/apps/web"
              npm ci
            fi

            if [ -f "$WORKSPACE/.ci-build-e2e" ]; then
              echo "[CI] Installing e2e dependencies..."
              cd "$WORKSPACE/apps/e2e"
              CYPRESS_INSTALL_BINARY=0 npm ci
            fi
          '''
        }
      }
    }

    stage('Validate') {
      when {
        expression { return fileExists('.ci-build-any') || fileExists('.ci-build-helm') }
      }

      parallel {
        stage('Web') {
          when {
            expression { return fileExists('.ci-build-web') }
          }
          steps {
            container('node') {
              dir('apps/web') {
                sh '''
                  npm run lint
                  npm run build
                '''
              }
            }
          }
        }

        stage('API') {
          when {
            expression { return fileExists('.ci-build-api') }
          }
          steps {
            container('golang') {
              dir('apps/api') {
                sh 'go test -mod=vendor ./...'
              }
            }
          }
        }

        stage('E2E & Helm') {
          when {
            expression { return fileExists('.ci-build-e2e') || fileExists('.ci-build-helm') }
          }
          steps {
            container('node') {
              dir('apps/e2e') {
                sh '''
                  if [ -f "$WORKSPACE/.ci-build-e2e" ]; then
                    npm run typecheck
                  fi
                '''
              }
            }

            container('helm') {
              sh '''
                # 1. Lint the main application chart (deploy/helm)
                MAIN_HELM="$WORKSPACE/deploy/helm"
                [ ! -d "$MAIN_HELM" ] && MAIN_HELM="$WORKSPACE/project-desk/chart"
                helm lint "$MAIN_HELM"

                # 2. Lint and template the E2E CronJob chart (apps/e2e/chart)
                cd "$WORKSPACE/apps/e2e"
                for env in dev staging prod; do
                  helm lint ./chart \
                    -f "chart/values-${env}.yaml" \
                    --set image.tag="ci-${BUILD_NUMBER}" \
                    --set-file dotenv=.env
                done

                helm template project-desk-e2e ./chart \
                  --namespace rwang \
                  -f chart/values-dev.yaml \
                  --set image.tag="${BUILD_NUMBER}" \
                  --set-file dotenv=.env > /dev/null
              '''
            }
          }
        }
      }
    }

    stage('Build & Push Images') {
      when {
        expression { return fileExists('.ci-build-any') }
      }

      steps {
        withCredentials([
          string(
            credentialsId: 'DOCKERHUB_USER',
            variable: 'DOCKERHUB_USER'
          ),
          string(
            credentialsId: 'DOCKERHUB_TOKEN',
            variable: 'DOCKERHUB_TOKEN'
          )
        ]) {
          container('buildkit') {
            sh '''
              set +x
              set -eu

              umask 077
              DOCKER_CONFIG=$(mktemp -d /tmp/projectdesk-docker.XXXXXX)
              export DOCKER_CONFIG
              trap 'rm -rf "$DOCKER_CONFIG"' EXIT

              AUTH=$(printf '%s:%s' \
                "$DOCKERHUB_USER" "$DOCKERHUB_TOKEN" \
                | base64 | tr -d '[:space:]')

              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' \
                "$AUTH" > "$DOCKER_CONFIG/config.json"

              unset AUTH

              for app in web api e2e; do
                if [ ! -f "$WORKSPACE/.ci-build-${app}" ]; then
                  echo "[BuildKit] Skipping project-desk-${app}: no changes detected."
                  continue
                fi

                CONTEXT="$WORKSPACE/apps/${app}"
                [ ! -d "$CONTEXT" ] && CONTEXT="$WORKSPACE/project-desk/${app}"

                IMAGE="docker.io/${DOCKERHUB_USER}/project-desk-${app}"

                IMAGE_TAGS="${IMAGE}:${BUILD_NUMBER}"

                # BRANCH_NAME is set by multibranch jobs, GIT_BRANCH by plain
                # pipeline jobs ("origin/main").
                BRANCH="${BRANCH_NAME:-${GIT_BRANCH:-}}"
                BRANCH="${BRANCH#origin/}"

                if [ "$BRANCH" = "main" ]; then
                  IMAGE_TAGS="${IMAGE_TAGS},${IMAGE}:latest"
                fi

                # CSV quoting keeps both image names in one exporter option.
                OUTPUT=$(printf 'type=image,"name=%s",push=true' "$IMAGE_TAGS")
                set -- build \
                  --progress=plain \
                  --frontend=dockerfile.v0 \
                  --local "context=${CONTEXT}" \
                  --local "dockerfile=${CONTEXT}" \
                  --output "$OUTPUT"

                # Optional public CA bundle consumed by the API Dockerfile's
                # secret mount on networks with TLS interception.
                if [ "$app" = "api" ] && [ -s "$CONTEXT/extra-ca.crt" ]; then
                  set -- "$@" --secret "id=extra-ca,src=${CONTEXT}/extra-ca.crt"
                fi

                echo "[BuildKit] Building and pushing project-desk-${app}..."

                buildctl-daemonless.sh "$@"

                echo "[BuildKit] Published ${IMAGE}:${BUILD_NUMBER}"
              done

              echo "=========================================================="
              echo "[CI] Images successfully built and published!"
              echo "[CI] Build tag: ${BUILD_NUMBER}"
              echo "=========================================================="
            '''
          }
        }
      }
    }

    stage('Trigger Deployment') {
      when {
        expression {
          def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
          branch = branch.replaceFirst('^origin/', '')
          def isMain = (branch == 'main' || branch == '')
          def hasImages = fileExists('.ci-build-web') || fileExists('.ci-build-api')
          return isMain && hasImages
        }
      }
      steps {
        script {
          def component = 'web+api'
          def hasWeb = fileExists('.ci-build-web')
          def hasApi = fileExists('.ci-build-api')
          if (hasWeb && !hasApi) {
            component = 'web'
          } else if (!hasWeb && hasApi) {
            component = 'api'
          }

          echo "=========================================================="
          echo "[CI] Automatically triggering ProjectDesk-Deploy..."
          echo "[CI] Component: ${component}"
          echo "[CI] Image Tag: ${env.BUILD_NUMBER}"
          echo "=========================================================="

          build job: 'ProjectDesk-Deploy', wait: false, parameters: [
            string(name: 'COMPONENT', value: component),
            string(name: 'IMAGE_TAG', value: "${env.BUILD_NUMBER}")
          ]
        }
      }
    }
  }
}
