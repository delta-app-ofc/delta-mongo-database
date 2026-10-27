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

let rejectedInvalidChatTitle = false;
try {
  db.chat_sessions.insertOne({ user_id: NumberInt(1), started_at: new Date(), title: 123 });
} catch (error) {
  rejectedInvalidChatTitle = error.code === 121;
}
assert(rejectedInvalidChatTitle, "chat_sessions rejects a document with a non-string title (code 121)");

print("MongoDB local smoke checks passed.");
