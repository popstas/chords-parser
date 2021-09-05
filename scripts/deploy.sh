#!/bin/bash
set -eu

NO_PUSH=${NO_PUSH:-}
msg=${1:-deploy}
rm -rf dist || true
git clone git@github.com:popstas/chords-data.git dist
cp chords.json dist
cd dist
git add -A
git commit -m "$msg"
if [ -z "$NO_PUSH" ]; then
    git push
fi
cd ..
