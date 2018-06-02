#!/bin/bash
set -eu

msg=${1:-deploy}
rm -rf dist || true
git clone git@github.com:popstas/chords-data.git dist
cp chords.json dist
cd dist
git add -A
git commit -m "$msg"
git push
cd ..
