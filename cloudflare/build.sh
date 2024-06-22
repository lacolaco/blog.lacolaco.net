# !/bin/bash

if [ "$CF_PAGES_BRANCH" == "main" ]; then
  PRODUCTION=true pnpm run buiid
else
  pnpm run build
fi
