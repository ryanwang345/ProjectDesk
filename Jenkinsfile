
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

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Validate') {
      when {
        not { changelog '\\[skip ci\\]' }
      }

      parallel {
        stage('Web') {
          steps {
            dir('project-desk') {
              sh '''
                npm ci
                npm run lint
                npm run build
              '''
            }
          }
        }

        stage('API') {
          steps {
            container('golang') {
              dir('project-desk/server') {
                sh 'go test -mod=vendor ./...'
              }
            }
          }
        }

        stage('E2E & Helm') {
          steps {
            dir('project-desk/e2e') {
              sh '''
                CYPRESS_INSTALL_BINARY=0 npm ci
                npm run typecheck
              '''

              container('helm') {
                sh '''
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
    }

    stage('Build & Push Images') {
      when {
        not { changelog '\\[skip ci\\]' }
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

              ROOT="$WORKSPACE/project-desk"

              for app in web api e2e; do
                case "$app" in
                  web)
                    CONTEXT="$ROOT"
                    ;;
                  api)
                    CONTEXT="$ROOT/server"
                    ;;
                  e2e)
                    CONTEXT="$ROOT/e2e"
                    ;;
                esac

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

                echo "Building project-desk-${app}"

                /kaniko/executor \
                  --context="dir://${CONTEXT}" \
                  --dockerfile="${CONTEXT}/Dockerfile" \
                  "$@"

                echo "Published ${IMAGE}:${BUILD_NUMBER}"
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
              VALUES="project-desk/chart/values.yaml"

              # Rebase onto the latest main each attempt so a commit pushed
              # while this build ran does not reject the tag update.
              for attempt in 1 2 3; do
                g fetch --quiet "$REMOTE" main
                g checkout --quiet --force -B ci-image-tag FETCH_HEAD

                awk -v tag="$BUILD_NUMBER" '
                  /^[^ ]/ { section=$1 }
                  (section == "api:" || section == "web:") && $1 == "tag:" {
                    q=sprintf("%c",34)
                    print "  tag: " q tag q
                    next
                  }
                  { print }
                ' "$VALUES" > "${VALUES}.new"

                mv "${VALUES}.new" "$VALUES"

                g add "$VALUES"

                if g diff --cached --quiet; then
                  echo "Helm image tags are already ${BUILD_NUMBER}"
                  exit 0
                fi

                g commit --quiet -m "ci: update image tag to ${BUILD_NUMBER} [skip ci]"

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
