FROM cypress/browsers:node-24.22.1-chrome-156.0.8078.73-1-ff-159.0-edge-156.0.4314.50-1

ENV CI=1 \
    CYPRESS_CACHE_FOLDER=/opt/cypress-cache \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    E2E_ARTIFACTS_ROOT=/artifacts

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --no-create-home --home-dir /tmp/home --shell /usr/sbin/nologin e2e \
 && mkdir -p /artifacts \
 && chown e2e:e2e /artifacts

WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci \
 && npx cypress install \
 && npx cypress verify \
 && npm cache clean --force

COPY tsconfig.json cypress.config.ts ./
COPY cypress ./cypress
COPY scripts ./scripts
COPY docker/entrypoint.sh /usr/local/bin/e2e-entrypoint

USER 10001
# Electron crashes with SIGTRAP when HOME is its own read-only-root tmpfs
# mount, so HOME lives under /tmp, the one writable path besides /artifacts.
ENV HOME=/tmp/home
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/usr/local/bin/e2e-entrypoint"]
