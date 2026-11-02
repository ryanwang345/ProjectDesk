FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -mod=vendor -o /server ./cmd/server

FROM alpine:3.20
RUN adduser -D -H app
USER app
COPY --from=build /server /server
EXPOSE 47292
ENV PORT=47292
ENTRYPOINT ["/server"]
