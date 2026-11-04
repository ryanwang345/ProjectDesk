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
            - name: node
              image: node:22-bookworm
              command: ['cat']
              tty: true
              resources:
                requests:
                  cpu: 500m
                  memory: 1Gi
                limits:
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
                  memory: 1Gi
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
  }
}
