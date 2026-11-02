/* global db, use, quit */

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

function expectMongoError(operation, code, message) {
  let caughtError;
  try {
    operation();
  } catch (error) {
    caughtError = error;
  }

  assert(caughtError && caughtError.code === code, `${message} (expected MongoDB code ${code})`);
}

function getIndex(collection, indexName) {
  return collection.getIndexes().find((index) => index.name === indexName);
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
  { name: "user_hour_baseline", indexes: ["idx_device_hour_of_week_unique"] },
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

const telemetryDb = db.getSiblingDB("db_delta_telemetry");
const appDb = db.getSiblingDB("db_delta_app");

const deviceIndex = getIndex(telemetryDb.device_status, "idx_device_id_unique");
assert(deviceIndex && deviceIndex.unique === true, "device_status enforces one document per device");

telemetryDb.device_status.updateOne(
  { device_id: "sonar-test-device" },
  { $set: { connectivity_status: "online", last_ping_at: new Date() } },
  { upsert: true }
);
telemetryDb.device_status.updateOne(
  { device_id: "sonar-test-device" },
  { $set: { connectivity_status: "offline", last_ping_at: new Date() } },
  { upsert: true }
);
assert(
  telemetryDb.device_status.countDocuments({ device_id: "sonar-test-device" }) === 1,
  "device_status upsert updates the single status document"
);
assert(
  telemetryDb.device_status.findOne({ device_id: "sonar-test-device" }).connectivity_status === "offline",
  "device_status upsert stores the latest status"
);
expectMongoError(
  () => telemetryDb.device_status.insertOne({ device_id: "sonar-test-device" }),
  11000,
  "device_status rejects a duplicate device_id"
);

telemetryDb.consumption_summary.insertOne({
  device_id: "sonar-test-device",
  user_id: NumberInt(7),
  window_started_at: new Date("2026-10-30T10:00:00Z"),
  window_finished_at: new Date("2026-10-30T10:05:00Z"),
  consumption_liters: 1.5,
  lpm_average: 0.3,
  anomaly_detected: false,
});
expectMongoError(
  () => telemetryDb.consumption_summary.insertOne({
    device_id: "sonar-test-device",
    user_id: "7",
    window_started_at: new Date("2026-10-30T10:00:00Z"),
    window_finished_at: new Date("2026-10-30T10:05:00Z"),
    consumption_liters: 1.5,
  }),
  121,
  "consumption_summary rejects a user_id with the wrong BSON type"
);

appDb.user_preferences.insertOne({ user_id: NumberInt(7), dark_mode_enabled: true });
expectMongoError(
  () => appDb.user_preferences.insertOne({ user_id: NumberInt(7), dark_mode_enabled: false }),
  11000,
  "user_preferences enforces one preferences document per user"
);

appDb.alerts_history.insertOne({
  device_id: "sonar-test-device",
  user_id: NumberInt(7),
  alert_type: "vazamento_continuo",
  triggered_at: new Date(),
  resolved_at: null,
  severity: "high",
});
expectMongoError(
  () => appDb.alerts_history.insertOne({
    device_id: "sonar-test-device",
    user_id: NumberInt(7),
    alert_type: "unknown_alert",
    triggered_at: new Date(),
  }),
  121,
  "alerts_history rejects an alert type outside its documented enum"
);
const unresolvedIndex = getIndex(appDb.alerts_history, "idx_device_unresolved_alerts");
assert(
  unresolvedIndex && unresolvedIndex.partialFilterExpression.resolved_at === null,
  "alerts_history limits its active-alert index to unresolved records"
);

appDb.user_hour_baseline.insertOne({
  device_id: "sonar-test-device",
  hour_of_week: NumberInt(10),
  count: NumberInt(3),
  median: Double(1.5),
  mad: Double(0.5),
  regime_state: "NORMAL",
  config_version: "test-1",
  updated_at: new Date(),
});
expectMongoError(
  () => appDb.user_hour_baseline.insertOne({
    device_id: "sonar-test-device",
    hour_of_week: NumberInt(10),
    count: NumberInt(1),
  }),
  11000,
  "user_hour_baseline enforces one baseline per device and hour of week"
);
expectMongoError(
  () => appDb.user_hour_baseline.insertOne({
    device_id: "sonar-test-device",
    hour_of_week: NumberInt(168),
    count: NumberInt(1),
  }),
  121,
  "user_hour_baseline rejects an hour_of_week outside 0-167"
);
expectMongoError(
  () => appDb.user_hour_baseline.insertOne({
    device_id: "sonar-test-device",
    hour_of_week: NumberInt(11),
    count: NumberInt(1),
    regime_state: "UNKNOWN",
  }),
  121,
  "user_hour_baseline rejects a regime_state outside its documented enum"
);

telemetryDb.consumption_summary.insertOne({
  device_id: "sonar-test-device",
  user_id: NumberInt(7),
  window_started_at: new Date("2026-10-30T10:05:00Z"),
  window_finished_at: new Date("2026-10-30T10:10:00Z"),
  consumption_liters: 1.5,
  anomaly_detected: null,
  detection_error: "owner lookup failed",
  detector_version: "test-1",
});

const validMessage = {
  role: "user",
  content_type: "text",
  content: "Valid test message",
  sent_at: new Date(),
  api_status_code: NumberInt(200),
};
const sessionResult = appDb.chat_sessions.insertOne({
  user_id: NumberInt(7),
  started_at: new Date(),
  last_activity_at: new Date(),
  is_open: true,
  messages: [validMessage],
});
expectMongoError(
  () => appDb.chat_sessions.insertOne({
    user_id: NumberInt(7),
    started_at: new Date(),
    messages: [{ ...validMessage, role: "assistant" }],
  }),
  121,
  "chat_sessions rejects a message role outside the bucket schema"
);
appDb.chat_feedback.insertOne({
  session_id: sessionResult.insertedId,
  is_satisfied: true,
  created_at: new Date(),
});
assert(
  appDb.chat_feedback.countDocuments({ session_id: sessionResult.insertedId }) === 1,
  "chat_feedback stores a feedback document linked to its session id"
);

function makeWeatherDocument() {
  return {
    location: { city: "SONAR TEST", state: "SP", country: "BR" },
    weather_date: new Date("2026-10-30T00:00:00Z"),
    hours: [],
    samples: NumberInt(0),
    created_at: new Date(),
  };
}

const weatherIndex = getIndex(appDb.weather_daily, "idx_location_date_unique");
assert(weatherIndex && weatherIndex.unique === true, "weather_daily enforces one record per location and date");
appDb.weather_daily.insertOne(makeWeatherDocument());
expectMongoError(
  () => appDb.weather_daily.insertOne(makeWeatherDocument()),
  11000,
  "weather_daily enforces one document per location and weather date"
);

print("MongoDB local smoke checks passed.");
