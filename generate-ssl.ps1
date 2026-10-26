$ErrorActionPreference = 'Stop'
$sslPath = Join-Path $PSScriptRoot 'nginx\ssl'
New-Item -ItemType Directory -Force -Path $sslPath | Out-Null

$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if ($openssl) {
  & $openssl.Source req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout (Join-Path $sslPath 'server.key') `
    -out (Join-Path $sslPath 'server.crt') `
    -subj '/C=VN/ST=ThaiNguyen/O=ICTU/CN=localhost/emailAddress=dtc245200493@ictu.edu.vn' `
    -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
  if ($LASTEXITCODE -ne 0) {
    throw "OpenSSL failed to generate the localhost certificate (exit code $LASTEXITCODE)."
  }
} else {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'OpenSSL was not found and Docker is unavailable. Install OpenSSL or Docker Desktop to generate the localhost certificate.'
  }

  $sourcePath = $sslPath.Replace('\', '/')
  docker run --rm --mount "type=bind,source=$sourcePath,target=/ssl" alpine:3.20 sh -c `
    "apk add --no-cache openssl >/dev/null && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /ssl/server.key -out /ssl/server.crt -subj '/C=VN/ST=ThaiNguyen/O=ICTU/CN=localhost/emailAddress=dtc245200493@ictu.edu.vn' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'"
  if ($LASTEXITCODE -ne 0) {
    throw "Docker could not generate the localhost certificate (exit code $LASTEXITCODE)."
  }
}

if (-not (Test-Path (Join-Path $sslPath 'server.crt')) -or -not (Test-Path (Join-Path $sslPath 'server.key'))) {
  throw 'Certificate generation finished without creating nginx/ssl/server.crt and server.key.'
}

Write-Host 'Da tao nginx/ssl/server.crt va server.key'
