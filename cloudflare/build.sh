# !/bin/bash

if [ "$CF_PAGES_BRANCH" == "main" ]; then
  PRODUCTION=true pnpm run build
else
  pnpm run build
fi
