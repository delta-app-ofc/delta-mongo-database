/* global db, load, ObjectId, NumberInt, Double */
// Executado apenas pelo Compose de testes, antes dos índices e do smoke.
const telemetry = db.getSiblingDB("db_delta_telemetry");
const app = db.getSiblingDB("db_delta_app");
function check(condition, message) { if (!condition) throw new Error(message); }
const id = new ObjectId();
const oldSchema = telemetry.getCollectionInfos({ name: "consumption_summary" })[0].options.validator;
oldSchema.$jsonSchema.properties.anomaly_detected.bsonType = "bool";
check(telemetry.runCommand({ collMod: "consumption_summary", validator: oldSchema }).ok === 1, "old validator applied");
telemetry.consumption_summary.insertOne({
  _id: id, device_id: "upgrade-device", user_id: NumberInt(7),
  window_started_at: new Date("2026-07-13T00:00:00Z"), window_finished_at: new Date("2026-07-13T00:05:00Z"),
  consumption_liters: Double(1.5), anomaly_detected: false
});
load("/scripts/delta-telemetry/script-migrate-anomaly-fields.js");
load("/scripts/delta-telemetry/script-migrate-anomaly-fields.js");
telemetry.consumption_summary.updateOne({ _id: id }, { $set: { anomaly_detected: null, detection_status: "pending" } });
check(telemetry.consumption_summary.findOne({ _id: id }).consumption_liters === 1.5, "migration preserves old data");
check(telemetry.consumption_summary.findOne({ _id: id }).detection_status === "pending", "new validator accepts pending");
// Simula instalação anterior à introdução do baseline: a coleção precisa nascer com validator.
app.user_hour_baseline.drop();
load("/scripts/delta-app/script-migrate-user-hour-baseline.js");
let rejected = false;
try { app.user_hour_baseline.insertOne({ device_id: "invalid", hour_of_week: NumberInt(999), count: NumberInt(0) }); }
catch (error) { rejected = error.code === 121; }
check(rejected, "new baseline collection has a validator before indexes");
const baselineId = new ObjectId();
app.user_hour_baseline.insertOne({ _id: baselineId, device_id: "upgrade", hour_of_week: NumberInt(0), count: NumberInt(0), slow_ready: true });
load("/scripts/delta-app/script-migrate-user-hour-baseline.js");
check(app.user_hour_baseline.findOne({ _id: baselineId }).slow_ready === true, "repeated baseline migration preserves data");
print("MongoDB upgrade checks passed.");
