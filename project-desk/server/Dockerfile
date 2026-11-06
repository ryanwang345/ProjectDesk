FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -mod=vendor -o /server ./cmd/server

FROM alpine:3.20
# git lets the development agent check and apply proposed diffs in a
# throwaway workspace. Nothing from a repository is executed on this host.
# extra-ca is optional. On networks that intercept TLS (Netskope), Alpine
# will not trust the package mirror unless that CA is appended first.
# The secret is not copied into the image.
RUN --mount=type=secret,id=extra-ca,required=false \
    sh -c 'if [ -s /run/secrets/extra-ca ]; then cat /run/secrets/extra-ca >> /etc/ssl/certs/ca-certificates.crt; fi' \
 && apk add --no-cache git ca-certificates \
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
