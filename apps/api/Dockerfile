FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -mod=vendor -o /server ./cmd/server

FROM alpine:3.20
# git lets the development agent check and apply proposed diffs in a
# throwaway workspace. Nothing from a repository is executed on this host.
# extra-ca is an optional public CA for networks that intercept TLS.
# Append it before apk so the package mirror verifies, then again after
# ca-certificates rewrites the bundle. The second copy is what the API
# process uses for outbound calls such as api.openai.com. The file is a
# certificate, never a private key, and it is not in git.
RUN --mount=type=secret,id=extra-ca,required=false \
    sh -c 'if [ -s /run/secrets/extra-ca ]; then cat /run/secrets/extra-ca >> /etc/ssl/certs/ca-certificates.crt; fi' \
 && apk add --no-cache git ca-certificates \
 && sh -c 'if [ -s /run/secrets/extra-ca ]; then cat /run/secrets/extra-ca >> /etc/ssl/certs/ca-certificates.crt; fi' \
 && adduser -D -H app
USER app
COPY --from=build /server /server
# Authorized repositories the coding agent may work on. Mount a volume at
# /repos in production; the sample is included so demo mode works out of
# the box.
COPY --from=build --chown=app:app /src/samples /repos
ENV PROJECT_DESK_REPOS=/repos
EXPOSE 47292
ENV PORT=47292
ENTRYPOINT ["/server"]
