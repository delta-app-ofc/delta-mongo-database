#!/bin/sh

set -eu

mkdir -p /reports

if mongosh --quiet mongodb://mongo:27017 --file /scripts/delta-telemetry/script-collections.js \
  && mongosh --quiet mongodb://mongo:27017 --file /scripts/delta-app/script-collections.js \
  && mongosh --quiet mongodb://mongo:27017 --file /scripts/delta-telemetry/script-indexes.js \
  && mongosh --quiet mongodb://mongo:27017 --file /scripts/delta-app/script-indexes.js \
  && mongosh --quiet mongodb://mongo:27017 --file /tests/smoke.js; then
  status=0
  failures=0
  failure_case=""
else
  status=$?
  failures=1
  failure_case="<failure type=\"IntegrationError\" message=\"MongoDB integration runner exited with status ${status}\"/>"
fi

printf '%s\n' \
  '<?xml version="1.0" encoding="UTF-8"?>' \
  "<testsuites tests=\"1\" failures=\"${failures}\">" \
  "  <testsuite name=\"mongo.compose\" tests=\"1\" failures=\"${failures}\">" \
  "    <testcase classname=\"mongo.integration\" name=\"collections_indexes_and_behavior\">${failure_case}</testcase>" \
  '  </testsuite>' \
  '</testsuites>' > /reports/junit.xml

exit "${status}"
