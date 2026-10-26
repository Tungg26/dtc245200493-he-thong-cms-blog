#!/usr/bin/env bash
set -euo pipefail

mkdir -p nginx/ssl
if command -v openssl >/dev/null 2>&1; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/server.key -out nginx/ssl/server.crt \
    -subj "/C=VN/ST=ThaiNguyen/O=ICTU/CN=localhost/emailAddress=dtc245200493@ictu.edu.vn" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
elif command -v docker >/dev/null 2>&1; then
  ssl_path="$(cd nginx/ssl && pwd)"
  docker run --rm --mount "type=bind,source=${ssl_path},target=/ssl" alpine:3.20 sh -c \
    "apk add --no-cache openssl >/dev/null && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /ssl/server.key -out /ssl/server.crt -subj '/C=VN/ST=ThaiNguyen/O=ICTU/CN=localhost/emailAddress=dtc245200493@ictu.edu.vn' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'"
else
  printf '%s\n' 'OpenSSL and Docker were not found. Install either one to generate the localhost certificate.' >&2
  exit 1
fi

test -s nginx/ssl/server.crt
test -s nginx/ssl/server.key
echo "Da tao nginx/ssl/server.crt va server.key"
