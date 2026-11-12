pipeline {
  agent {
    kubernetes {
      cloud 'local-k8s'
      defaultContainer 'node'
      yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: node
      image: node:22-bookworm
      command: ['cat']
      tty: true
      resources:
        requests:
          memory: 1Gi
          cpu: 500m

    - name: golang
      image: golang:1.22-bookworm
      command: ['cat']
      tty: true

    - name: helm
      image: alpine/helm:4.3.1
      command: ['cat']
      tty: true

    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.23.2-debug
      command: ['/busybox/cat']
      tty: true
      resources:
        requests:
          memory: 1Gi
          cpu: 500m
        limits:
          memory: 3Gi
      securityContext:
        runAsUser: 0
'''
    }
  }

  // The VM Jenkins is not reachable by GitHub webhooks, so poll for new
  // commits. CI's own "[skip ci]" tag commits skip every stage.
  triggers {
    pollSCM('H/2 * * * *')
  }

  parameters {
    booleanParam(
      name: 'FORCE_ALL',
      defaultValue: false,
      description: 'Force build and push ALL components'
    )
    booleanParam(
      name: 'FORCE_WEB',
      defaultValue: false,
      description: 'Force build and push Web frontend (project-desk-web)'
    )
    booleanParam(
      name: 'FORCE_API',
      defaultValue: false,
      description: 'Force build and push Go API backend (project-desk-api)'
    )
    booleanParam(
      name: 'FORCE_E2E',
      defaultValue: false,
      description: 'Force build and push E2E tests (project-desk-e2e)'
    )
  }

  environment {
    FORCE_ALL = "${params.FORCE_ALL ?: false}"
    FORCE_WEB = "${params.FORCE_WEB ?: false}"
    FORCE_API = "${params.FORCE_API ?: false}"
    FORCE_E2E = "${params.FORCE_E2E ?: false}"
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

            if echo "$COMMIT_MSG" | grep -q '\\[skip ci\\]'; then
              echo "[CI] [skip ci] detected in commit message. Skipping build."
              exit 0
            fi

            # Check if force build is requested via parameters or commit message
            if [ "${FORCE_ALL:-false}" = "true" ] || echo "$COMMIT_MSG" | grep -qiE '\\[(force build|build all)\\]'; then
              echo "[CI] Force build ALL requested. Marking all components for build."
              touch .ci-build-web .ci-build-api .ci-build-e2e .ci-build-helm .ci-build-any
              exit 0
            fi

            if [ "${FORCE_WEB:-false}" = "true" ] || echo "$COMMIT_MSG" | grep -qi '\\[build web\\]'; then
              echo "[CI] Force build WEB requested."
              touch .ci-build-web .ci-build-any
            fi

            if [ "${FORCE_API:-false}" = "true" ] || echo "$COMMIT_MSG" | grep -qi '\\[build api\\]'; then
              echo "[CI] Force build API requested."
              touch .ci-build-api .ci-build-any
            fi

            if [ "${FORCE_E2E:-false}" = "true" ] || echo "$COMMIT_MSG" | grep -qi '\\[build e2e\\]'; then
              echo "[CI] Force build E2E requested."
              touch .ci-build-e2e .ci-build-any
            fi

            # Determine base commit to diff against
            BASE_COMMIT=""
            if [ -n "${GIT_PREVIOUS_SUCCESSFUL_COMMIT:-}" ] && g cat-file -e "${GIT_PREVIOUS_SUCCESSFUL_COMMIT}^{commit}" 2>/dev/null; then
              BASE_COMMIT="$GIT_PREVIOUS_SUCCESSFUL_COMMIT"
              echo "[CI] Comparing against previous successful commit: ${BASE_COMMIT}"
            elif [ -n "${GIT_PREVIOUS_COMMIT:-}" ] && g cat-file -e "${GIT_PREVIOUS_COMMIT}^{commit}" 2>/dev/null; then
              BASE_COMMIT="$GIT_PREVIOUS_COMMIT"
              echo "[CI] Comparing against previous build commit: ${BASE_COMMIT}"
            elif g rev-parse --verify HEAD~1 >/dev/null 2>&1; then
              BASE_COMMIT="HEAD~1"
              echo "[CI] Comparing against HEAD~1"
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

            # 1. API: changes under apps/api/ (or legacy project-desk/server/)
            if echo "$CHANGED_FILES" | grep -q -E '^(apps/api/|project-desk/server/)'; then
              echo "[CI] -> Detected API changes"
              touch .ci-build-api .ci-build-any
            fi

            # 2. E2E: changes under apps/e2e/ (or legacy project-desk/e2e/)
            if echo "$CHANGED_FILES" | grep -q -E '^(apps/e2e/|project-desk/e2e/)'; then
              echo "[CI] -> Detected E2E changes"
              touch .ci-build-e2e .ci-build-any
            fi

            # 3. Helm: changes under deploy/helm/ (or legacy project-desk/chart/)
            if echo "$CHANGED_FILES" | grep -q -E '^(deploy/helm/|project-desk/chart/)'; then
              echo "[CI] -> Detected Helm chart changes"
              touch .ci-build-helm
            fi

            # 4. Web: changes under apps/web/
            if echo "$CHANGED_FILES" | grep -q -E '^apps/web/'; then
              echo "[CI] -> Detected Web frontend changes"
              touch .ci-build-web .ci-build-any
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
        allOf {
          not { changelog '\\[skip ci\\]' }
          expression { return fileExists('.ci-build-web') || fileExists('.ci-build-e2e') }
        }
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
        allOf {
          not { changelog '\\[skip ci\\]' }
          expression { return fileExists('.ci-build-any') || fileExists('.ci-build-helm') }
        }
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
                HELM_DIR="$WORKSPACE/deploy/helm"
                [ ! -d "$HELM_DIR" ] && HELM_DIR="$WORKSPACE/project-desk/chart"

                for env in dev staging prod; do
                  helm lint "$HELM_DIR" \
                    -f "${HELM_DIR}/values-${env}.yaml" \
                    --set image.tag="ci-${BUILD_NUMBER}" \
                    --set-file dotenv=.env
                done

                helm template project-desk-e2e "$HELM_DIR" \
                  --namespace rwang \
                  -f "${HELM_DIR}/values-dev.yaml" \
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
        allOf {
          not { changelog '\\[skip ci\\]' }
          expression { return fileExists('.ci-build-any') }
        }
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
          container('kaniko') {
            sh '''
              set +x
              set -eu

              mkdir -p /kaniko/.docker
              trap 'rm -f /kaniko/.docker/config.json' EXIT

              AUTH=$(printf '%s:%s' \
                "$DOCKERHUB_USER" "$DOCKERHUB_TOKEN" \
                | base64 | tr -d '[:space:]')

              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' \
                "$AUTH" > /kaniko/.docker/config.json

              chmod 600 /kaniko/.docker/config.json
              unset AUTH

              for app in web api e2e; do
                if [ ! -f "$WORKSPACE/.ci-build-${app}" ]; then
                  echo "[Kaniko] Skipping project-desk-${app}: no changes detected."
                  continue
                fi

                CONTEXT="$WORKSPACE/apps/${app}"
                [ ! -d "$CONTEXT" ] && CONTEXT="$WORKSPACE/project-desk/${app}"

                IMAGE="docker.io/${DOCKERHUB_USER}/project-desk-${app}"

                set -- "--destination=${IMAGE}:${BUILD_NUMBER}"

                # BRANCH_NAME is set by multibranch jobs, GIT_BRANCH by plain
                # pipeline jobs ("origin/main").
                BRANCH="${BRANCH_NAME:-${GIT_BRANCH:-}}"
                BRANCH="${BRANCH#origin/}"

                if [ "$BRANCH" = "main" ]; then
                  set -- "$@" "--destination=${IMAGE}:latest"
                fi

                if [ "$app" = "e2e" ]; then
                  set -- "$@" \
                    --snapshot-mode=redo \
                    --compressed-caching=false
                fi

                echo "[Kaniko] Building and pushing project-desk-${app}..."

                /kaniko/executor \
                  --context="dir://${CONTEXT}" \
                  --dockerfile="${CONTEXT}/Dockerfile" \
                  "$@"

                echo "[Kaniko] Published ${IMAGE}:${BUILD_NUMBER}"
              done
            '''
          }
        }
      }
    }

    stage('Update Helm Image Tags') {
      // GitOps hand-off: Jenkins writes the new immutable tag to values.yaml
      // on main, and ArgoCD (auto-sync) rolls it out to the cluster.
      when {
        allOf {
          // `branch` only works in multibranch jobs; GIT_BRANCH covers
          // plain pipeline jobs ("origin/main").
          expression {
            (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replaceFirst('^origin/', '') == 'main'
          }
          not { changelog '\\[skip ci\\]' }
          expression { return fileExists('.ci-build-web') || fileExists('.ci-build-api') }
        }
      }

      steps {
        withCredentials([
          string(
            credentialsId: 'GITHUB_TOKEN',
            variable: 'GITHUB_TOKEN'
          )
        ]) {
          container('jnlp') {
            sh '''
              set +x
              set -eu

              cd "$WORKSPACE"

              g() {
                git -c safe.directory="$WORKSPACE" \
                  -c user.name="ProjectDesk CI" \
                  -c user.email="ci@users.noreply.github.com" \
                  "$@"
              }

              ASKPASS="$WORKSPACE/.git-askpass"
              trap 'rm -f "$ASKPASS"' EXIT

              printf '%s\\n' \
                '#!/bin/sh' \
                'printf "%s" "$GITHUB_TOKEN"' > "$ASKPASS"

              chmod 700 "$ASKPASS"

              export GIT_ASKPASS="$ASKPASS"
              export GIT_TERMINAL_PROMPT=0

              REMOTE="https://x-access-token@github.com/ryanwang345/ProjectDesk.git"
              VALUES="deploy/helm/values.yaml"
              [ ! -f "$VALUES" ] && VALUES="project-desk/chart/values.yaml"

              UPDATE_WEB="false"
              UPDATE_API="false"
              [ -f "$WORKSPACE/.ci-build-web" ] && UPDATE_WEB="true"
              [ -f "$WORKSPACE/.ci-build-api" ] && UPDATE_API="true"

              # Rebase onto the latest main each attempt so a commit pushed
              # while this build ran does not reject the tag update.
              for attempt in 1 2 3; do
                g fetch --quiet "$REMOTE" main
                g checkout --quiet --force -B ci-image-tag FETCH_HEAD

                awk -v tag="$BUILD_NUMBER" -v updateWeb="$UPDATE_WEB" -v updateApi="$UPDATE_API" '
                  /^[^ ]/ { section=$1 }
                  section == "api:" && $1 == "tag:" && updateApi == "true" {
                    q=sprintf("%c",34)
                    print "  tag: " q tag q
                    next
                  }
                  section == "web:" && $1 == "tag:" && updateWeb == "true" {
                    q=sprintf("%c",34)
                    print "  tag: " q tag q
                    next
                  }
                  { print }
                ' "$VALUES" > "${VALUES}.new"

                mv "${VALUES}.new" "$VALUES"

                g add "$VALUES"

                if g diff --cached --quiet; then
                  echo "Helm image tags are already up to date"
                  exit 0
                fi

                MSG="ci: update"
                [ "$UPDATE_WEB" = "true" ] && MSG="${MSG} web"
                [ "$UPDATE_API" = "true" ] && MSG="${MSG} api"
                MSG="${MSG} image tag to ${BUILD_NUMBER} [skip ci]"

                g commit --quiet -m "$MSG"

                if g push "$REMOTE" HEAD:main; then
                  echo "Helm image tags updated to ${BUILD_NUMBER}; ArgoCD will roll it out"
                  exit 0
                fi

                echo "Push rejected (attempt ${attempt}), retrying"
                sleep 5
              done

              echo "Could not push the image tag update"
              exit 1
            '''
          }
        }
      }
    }
  }
}
