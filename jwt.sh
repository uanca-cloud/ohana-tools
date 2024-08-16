#!/bin/bash
command="node --max-http-header-size 65535 ./jwt-util.js $@"
echo "$command"
eval "$command"
