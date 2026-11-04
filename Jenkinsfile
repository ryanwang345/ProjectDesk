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
      }
    }

    stage('Push images') {
      steps {
        container('kaniko') {
          withCredentials([usernamePassword(credentialsId: 'dockerhub-rwang', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
            sh '''
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
              echo "Pushed docker.io/${DOCKERHUB_USER}/project-desk-web:${BUILD_NUMBER}"
              echo "Pushed docker.io/${DOCKERHUB_USER}/project-desk-api:${BUILD_NUMBER}"
            '''
          }
        }
      }
    }
  }
}
