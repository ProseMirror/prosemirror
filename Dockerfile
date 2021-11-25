FROM debian:bullseye-20210721-slim@sha256:9bfa0f4fb6d32116de4a6172f89a9266f7c73d1b8dae46f765bed703e541175e

ENV LANG     C.UTF-8
ENV LC_ALL   C.UTF-8
ENV LANGUAGE C.UTF-8

# System deps
RUN apt-get update -y && apt-get install curl gnupg -y && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update -y && \
    apt-get install -y nodejs yarn git npm

# Files
COPY . /workdir
WORKDIR /workdir

# Install everything
RUN bin/pm install
