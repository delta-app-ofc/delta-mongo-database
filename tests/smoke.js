/* global db, use, quit, print, NumberInt, NumberLong, ISODate */

function fail(message) {
  print(`FAIL: ${message}`);
  quit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function checkCollections(expected) {
  const collectionNames = db.getCollectionNames();

  for (const collection of expected) {
    assert(collectionNames.includes(collection.name), `collection ${collection.name} exists`);

    const info = db.getCollectionInfos({ name: collection.name })[0];
    assert(
      info && info.options && info.options.validator && info.options.validator.$jsonSchema,
      `collection ${collection.name} has its JSON Schema validator`
    );

    const indexNames = db.getCollection(collection.name).getIndexes().map((index) => index.name);
    for (const indexName of collection.indexes) {
      assert(indexNames.includes(indexName), `index ${indexName} exists on ${collection.name}`);
    }
  }
}

use("db_delta_telemetry");
checkCollections([
  { name: "consumption_summary", indexes: ["idx_user_window_time", "idx_device"] },
  { name: "device_status", indexes: ["idx_device_id_unique"] },
]);

use("db_delta_app");
checkCollections([
  { name: "user_preferences", indexes: ["idx_user_id_unique"] },
  { name: "alerts_history", indexes: ["idx_user_triggered_at_desc", "idx_device_unresolved_alerts"] },
  { name: "chat_sessions", indexes: ["idx_user_activity_desc", "idx_user_open_sessions"] },
  { name: "chat_feedback", indexes: ["idx_session_id"] },
  { name: "weather_daily", indexes: ["idx_location_date_unique"] },
]);

let rejectedInvalidDocument = false;
try {
  db.user_preferences.insertOne({ user_id: "invalid", dark_mode_enabled: true });
} catch (error) {
  rejectedInvalidDocument = error.code === 121;
}
assert(rejectedInvalidDocument, "user_preferences rejects a document with an invalid user_id type (code 121)");

// Os grupos novos são opcionais para documentos antigos e completos quando presentes.
function rejects(collection, document, description) {
  let rejected = false;
  try {
    collection.insertOne(document);
  } catch (error) {
    rejected = error.code === 121;
  }
  assert(rejected, description + " (code 121)");
}

const chat = db.getCollection("chat_sessions");
const legacyMessage = { role: "bot", content_type: "text", content: "Teste", api_status_code: NumberInt(200) };
const response = Object.assign({}, legacyMessage, {
  agent_name: "consumption", response_time_ms: NumberLong(1800), response_time_is_mock: true
});
function session(message) {
  return { user_id: NumberInt(999001), started_at: new Date(), messages: [message] };
}
assert(chat.insertOne(session(legacyMessage)).acknowledged, "legacy messages remain accepted");
assert(chat.insertOne(session(response)).acknowledged, "new response metrics are accepted");
rejects(chat, session(Object.assign({}, response, { response_time_ms: NumberInt(-1) })), "negative response duration rejected");
rejects(chat, session(Object.assign({}, response, { response_time_ms: "1800" })), "string response duration rejected");
rejects(chat, session(Object.assign({}, legacyMessage, { agent_name: "consumption" })), "incomplete response metrics rejected");

use("db_delta_telemetry");
const status = db.getCollection("device_status");
assert(status.insertOne({ device_id: "LEGACY-TEST" }).acknowledged, "legacy device remains accepted");
const availability = {
  device_id: "METRICS-TEST",
  availability_started_at: ISODate("2026-07-17T00:00:00Z"),
  availability_updated_at: ISODate("2026-07-17T01:00:00Z"),
  available_seconds: NumberLong(3000),
  availability_is_mock: true,
  unavailabilities: [{
    started_at: ISODate("2026-07-17T00:50:00Z"), ended_at: null,
    unavailable_seconds: NumberLong(600), unavailability_reason: "Sem conexão"
  }]
};
assert(status.insertOne(availability).acknowledged, "open unavailability accepted");
rejects(status, Object.assign({}, availability, { device_id: "BAD-NEGATIVE", available_seconds: NumberInt(-1) }), "negative available duration rejected");
rejects(status, { device_id: "BAD-PARTIAL", available_seconds: NumberInt(0) }, "incomplete availability rejected");
rejects(status, Object.assign({}, availability, {
  device_id: "BAD-EVENT",
  unavailabilities: [{ started_at: new Date(), ended_at: null, unavailable_seconds: NumberInt(-1), unavailability_reason: null }]
}), "negative unavailable duration rejected");
rejects(status, Object.assign({}, availability, {
  device_id: "BAD-REASON",
  unavailabilities: [{ started_at: new Date(), ended_at: null, unavailable_seconds: NumberInt(0) }]
}), "unavailability without reason field rejected");

print("Response and availability metric checks passed.");
print("MongoDB local smoke checks passed.");
