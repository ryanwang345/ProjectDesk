# CI image builds

Jenkins uses `moby/buildkit:v0.34.2-rootless` to build the Dockerfiles in
`apps/web`, `apps/api`, and `apps/e2e`. Each selected build starts an ephemeral
BuildKit daemon with `buildctl-daemonless.sh` and pushes directly to Docker Hub.
The builder runs as UID/GID 1000. Its state lives on a pod-scoped `emptyDir`;
there is no Docker socket, host mount, privileged container, or shared service.

## Tags and deployment

- Changed components publish `docker.io/$DOCKERHUB_USER/project-desk-<app>:$BUILD_NUMBER`.
- Builds on `main` also publish `:latest` for each selected component.
- Changes to `Jenkinsfile` select all components so builder changes are exercised.
- After a successful push on `main`, Jenkins commits the selected web/API tags to
  `deploy/helm/values.yaml` with `[skip ci]`. Argo CD reconciles that commit.
- The separate E2E dev CronJob pulls `:latest`. Jenkins typechecks its specs;
  browser execution happens in the CronJob or through `npm run e2e`.

Docker Hub credentials are written with owner-only permissions to a temporary
`DOCKER_CONFIG` directory outside the build contexts and removed when the stage
exits, including on build failure. The API build passes `extra-ca.crt` as a
BuildKit secret when a nonempty bundle exists in its context. That optional
public certificate bundle supports TLS interception; no secret value is added
to the Dockerfile or passed as a build argument.

## Kubernetes runner requirements

The pod template follows BuildKit's [rootless Kubernetes example](https://github.com/moby/buildkit/blob/v0.34.2/examples/kubernetes/pod.rootless.yaml):

- Linux workers must allow unprivileged user namespaces and subordinate UID/GID
  mappings. Node AppArmor policy must permit rootless user namespaces.
- Kubernetes must support `securityContext.appArmorProfile` (1.30 or newer),
  and admission policy must allow the builder's unconfined seccomp and AppArmor
  profiles. These relaxations are scoped to the build container.
- `--oci-worker-no-process-sandbox` allows Dockerfile build steps to share the
  daemon's PID namespace. Use this disposable agent only for trusted builds;
  keep pod process-namespace sharing disabled.
- The native snapshotter avoids a `/dev/fuse` device or overlayfs requirement,
  at the cost of copying files for snapshots. The state volume is writable by
  UID/GID 1000 through the pod's `fsGroup`.

See the upstream [rootless documentation](https://github.com/moby/buildkit/blob/v0.34.2/docs/rootless.md)
for kernel and AppArmor troubleshooting. Node sysctls and admission policy are
cluster configuration and are not changed by this repository.

## Verify a rollout

Run a Jenkins feature-branch build with all component flags enabled. Confirm
that the pod starts, each Dockerfile builds, and only build-number tags are
pushed. A build failure must fail the stage before the Helm tag update.

After merging to `main`, confirm both build-number and `latest` tags are pushed,
the web/API values commit contains the build number, and Argo CD syncs it.
Confirm the E2E dev CronJob can pull its image and write its artifacts separately.
These registry, Jenkins, and cluster checks require the live CI environment.
