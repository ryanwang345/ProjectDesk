pipeline {
  agent {
    kubernetes {
      inheritFrom 'kubernetes-teams-vail'
      defaultContainer 'node'
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          containers:
            - name: jnlp
              resources:
                requests:
                  cpu: 100m
                  memory: 256Mi
                limits:
                  cpu: "1"
                  memory: 512Mi
            - name: node
              image: node:22-bookworm
              command: ['cat']
              tty: true
              resources:
                requests:
                  cpu: 500m
                  memory: 1Gi
                limits:
                  cpu: "1"
                  memory: 2Gi
            - name: golang
              image: golang:1.22-bookworm
              command: ['cat']
              tty: true
              resources:
                requests:
                  cpu: 500m
                  memory: 512Mi
                limits:
                  cpu: "1"
                  memory: 1Gi
            - name: helm
              image: alpine/helm:4.3.1
              command: ['cat']
              tty: true
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
                limits:
                  cpu: 500m
                  memory: 256Mi
            - name: kaniko
              image: gcr.io/kaniko-project/executor:v1.23.2-debug
              command: ['/busybox/cat']
              tty: true
              securityContext:
                runAsUser: 0
              resources:
                requests:
                  cpu: 500m
                  memory: 1Gi
                limits:
                  cpu: "2"
                  memory: 3Gi
      '''
    }
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Check') {
      when {
        not {
          changelog '\\[skip ci\\]' // Skip checking if the commit message contains "[skip ci]"
        }
      }
      parallel {
        stage('Web') {
          steps {
            dir('project-desk') {
              sh 'npm ci'
              sh 'npm run lint'
              sh 'npm run build'
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
        stage('E2E') {
          steps {
            dir('project-desk/e2e') {
              // The Cypress binary is installed and verified in the image build.
              sh 'CYPRESS_INSTALL_BINARY=0 npm ci'
              sh 'npm run typecheck'
              container('helm') {
                sh '''
                  for env in dev staging prod; do
                    helm lint ./chart -f "chart/values-${env}.yaml" --set image.tag="ci-${BUILD_NUMBER}" --set-file dotenv=.env
                  done
                  helm template project-desk-e2e ./chart --namespace rwang \
                    -f chart/values-dev.yaml --set image.tag="${BUILD_NUMBER}" --set-file dotenv=.env > /dev/null
                '''
              }
            }
          }
        }
      }
    }

    stage('Push images') {
      when {
        not {
          changelog '\\[skip ci\\]' // Skip pushing images if the commit message contains "[skip ci]"
        }
      }
      steps {
        container('kaniko') {
          sh '''
            if [ -z "$DOCKERHUB_USER" ] || [ -z "$DOCKERHUB_TOKEN" ]; then
              echo "DOCKERHUB_USER and DOCKERHUB_TOKEN must be set on the Project Desk job."
              exit 1
            fi
            mkdir -p /kaniko/.docker
            AUTH=$(printf "%s:%s" "$DOCKERHUB_USER" "$DOCKERHUB_TOKEN" | base64 | tr -d '\n')
            printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}\n' "$AUTH" > /kaniko/.docker/config.json

            ROOT="${WORKSPACE:-$(pwd)}"
            WEB_DEST="--destination=docker.io/${DOCKERHUB_USER}/project-desk-web:${BUILD_NUMBER}"
            API_DEST="--destination=docker.io/${DOCKERHUB_USER}/project-desk-api:${BUILD_NUMBER}"
            if [ "$BRANCH_NAME" = "main" ]; then
              WEB_DEST="$WEB_DEST --destination=docker.io/${DOCKERHUB_USER}/project-desk-web:latest"
              API_DEST="$API_DEST --destination=docker.io/${DOCKERHUB_USER}/project-desk-api:latest"
            fi

            /kaniko/executor --context="dir://${ROOT}/project-desk" --dockerfile="${ROOT}/project-desk/Dockerfile" $WEB_DEST
            /kaniko/executor --context="dir://${ROOT}/project-desk/server" --dockerfile="${ROOT}/project-desk/server/Dockerfile" $API_DEST
            # The Cypress image is about 3 GB unpacked; redo snapshots and no
            # compressed caching keep Kaniko under its memory limit.
            /kaniko/executor --context="dir://${ROOT}/project-desk/e2e" --dockerfile="${ROOT}/project-desk/e2e/Dockerfile" \
              --snapshot-mode=redo --compressed-caching=false \
              --destination="docker.io/${DOCKERHUB_USER}/project-desk-e2e:${BUILD_NUMBER}"
            echo "Pushed docker.io/${DOCKERHUB_USER}/project-desk-web:${BUILD_NUMBER}"
            echo "Pushed docker.io/${DOCKERHUB_USER}/project-desk-api:${BUILD_NUMBER}"
            echo "Pushed docker.io/${DOCKERHUB_USER}/project-desk-e2e:${BUILD_NUMBER}"
          '''
        }
      }
    }

    stage('Record image tag') {
      when {
        allOf {
          branch 'main'
          not {
            changelog '\\[skip ci\\]'
          }
        }
      }
      steps {
        container('jnlp') {
          sh '''
            if [ -z "$GITHUB_TOKEN" ]; then
              echo "GITHUB_TOKEN must be set on the Project Desk job so the image tag can be committed."
              exit 1
            fi
            ROOT="${WORKSPACE:-$(pwd)}"
            cd "$ROOT"
            awk -v tag="$BUILD_NUMBER" '
              $0 ~ /^[^ ]/ { section=$1 }
              section ~ /^api:/ && $1 == "tag:" { print "  tag: \\"" tag "\\""; next }
              section ~ /^web:/ && $1 == "tag:" { print "  tag: \\"" tag "\\""; next }
              { print }
            ' project-desk/chart/values.yaml > project-desk/chart/values.yaml.new
            mv project-desk/chart/values.yaml.new project-desk/chart/values.yaml
            awk -v tag="$BUILD_NUMBER" '
              $0 ~ /^[^ ]/ { section=$1 }
              section ~ /^image:/ && $1 == "tag:" { print "  tag: \\"" tag "\\""; next }
              { print }
            ' project-desk/e2e/chart/values-dev.yaml > project-desk/e2e/chart/values-dev.yaml.new
            mv project-desk/e2e/chart/values-dev.yaml.new project-desk/e2e/chart/values-dev.yaml
            git add project-desk/chart/values.yaml project-desk/e2e/chart/values-dev.yaml
            if git diff --cached --quiet; then
              echo "Image tags already match build ${BUILD_NUMBER}"
              exit 0
            fi
            git -c safe.directory="$ROOT" -c user.email="rwang@vailsys.com" -c user.name="Ryan Wang" \
              commit -m "Roll Project Desk to image ${BUILD_NUMBER} [skip ci]"
            printf '%s\n' '#!/bin/sh' 'printf "%s" "$GITHUB_TOKEN"' > "$ROOT/.git-askpass"
            chmod 700 "$ROOT/.git-askpass"
            GIT_ASKPASS="$ROOT/.git-askpass" GIT_TERMINAL_PROMPT=0 \
              git -c safe.directory="$ROOT" \
              push "https://x-access-token@github.com/ryanwang345/ProjectDesk.git" HEAD:main
            rm -f "$ROOT/.git-askpass"
          '''
        }
      }
    }
  }
}
