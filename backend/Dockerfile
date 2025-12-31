# ============================================
# Build main application
# ============================================
FROM golang:1.24-alpine AS go_builder

WORKDIR /app

COPY go.mod go.sum ./
COPY . .
RUN go mod download


RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o pwnthemall

# ============================================
# Dev stage
# ============================================
FROM golang:1.24-alpine AS dev

ARG PTA_PLUGINS_ENABLED
ENV PTA_PLUGINS_ENABLED=${PTA_PLUGINS_ENABLED}

WORKDIR /app

RUN apk --no-cache add ca-certificates openssh-client

RUN adduser -D -u 1000 -s /sbin/nologin app && \ 
    mkdir -p /home/app/.ssh && \
    chown -R app:app /home/app/.ssh && \
    chmod 700 /home/app/.ssh && \
    chown -R app:app /app

USER app

RUN mkdir -p /app/tmp /app/plugins
RUN go install github.com/air-verse/air@v1.61.7

COPY --chown=app:app . .
RUN go mod download

COPY entrypoint.dev.sh /entrypoint.sh

EXPOSE 8080

CMD ["sh", "/entrypoint.sh"]

# ============================================
# Prod stage
# ============================================
FROM alpine:3.22 AS prod

ARG DOCKER_GID
ENV DOCKER_GID=${DOCKER_GID}
ARG PTA_PLUGINS_ENABLED
ENV PTA_PLUGINS_ENABLED=${PTA_PLUGINS_ENABLED}

WORKDIR /app

RUN apk --no-cache add ca-certificates openssh-client

RUN mkdir -p /app/config /app/plugins

RUN adduser -D -u 1000 -s /sbin/nologin app && \ 
    mkdir -p /home/app/.ssh && \
    chown -R app:app /home/app/.ssh && \
    chmod 700 /home/app/.ssh && \
    EXISTING_GROUP=$(getent group ${DOCKER_GID} | cut -d: -f1) && \
    if [ -z "$EXISTING_GROUP" ]; then \
      addgroup -g ${DOCKER_GID} docker; \
      GROUP_TO_USE=docker; \
    else \
      GROUP_TO_USE=$EXISTING_GROUP; \
    fi && \
    adduser app $GROUP_TO_USE && \
    chown -R app:app /app/plugins

USER app

COPY --from=go_builder /app/pwnthemall /app/pwnthemall

COPY config/casbin_model.conf /app/config/
COPY config/casbin_policies.csv /app/config/
COPY entrypoint.prod.sh /entrypoint.sh
COPY ./.dockerignore plugins/ /app/plugins/

EXPOSE 8080

CMD ["sh", "/entrypoint.sh"]
