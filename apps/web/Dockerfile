FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Keep downloaded packages across dependency-layer rebuilds. Docker Desktop can
# briefly lose registry DNS during large parallel installs, so limit sockets and
# retry those transient failures. The optional CA is needed on TLS-inspecting
# networks and is never copied into the image.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=secret,id=extra-ca,required=false \
    sh -ec 'if [ -s /run/secrets/extra-ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra-ca; fi; \
      npm ci --no-audit --no-fund --prefer-offline \
        --fetch-retries=8 \
        --fetch-retry-factor=2 \
        --fetch-retry-mintimeout=1000 \
        --fetch-retry-maxtimeout=30000 \
        --maxsockets=5'
COPY . .
RUN npm run build

FROM nginx:1.28-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
