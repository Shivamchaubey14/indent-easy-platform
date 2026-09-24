#!/bin/sh
# Fails unless every URL given is protected by Cloudflare Access, i.e. an anonymous request is
# redirected to the Access login instead of receiving the page. Used before and after publishing
# the API docs, so they are never readable without signing in.
set -eu
status=0
for url in "$@"; do
  result=$(curl -s -o /dev/null --max-time 20 -w '%{http_code} %{redirect_url}' "$url" || echo "000 -")
  code=${result%% *}
  location=${result#* }
  case "$code:$location" in
    30[1-8]:*cloudflareaccess.com*)
      echo "ok   $url is behind Cloudflare Access"
      ;;
    *)
      echo "::error::$url is NOT protected by Cloudflare Access (HTTP $code, redirect: $location)"
      status=1
      ;;
  esac
done
exit $status
