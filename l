#!/usr/bin/env bash

./node_modules/.bin/tsc l3.ts --types node && node l3.js "$1" && rm l3.js

