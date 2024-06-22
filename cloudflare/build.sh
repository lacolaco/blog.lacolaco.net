# !/bin/bash

if [ "$CF_PAGES_BRANCH" == "main" ]; then
  PRODUCTION=true npm run buiid

else
  npm run build
fi
