// Verificação estrutural dos scripts reais, sem conectar ao MongoDB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const folder = path.join(__dirname, "../scripts/delta-app");
const definitions = {};
const seeds = {};
const indexes = {};
const collections = new Proxy({}, {
  get(_, name) {
    return {
      insertMany(docs) { seeds[name] = docs; },
      insertOne(doc) { seeds[name] = [doc]; },
      findOne() { return { _id: "seed-session" }; },
      createIndex(key, options) { indexes[options.name] = { key, options }; }
    };
  }
});
const db = new Proxy(collections, {
  get(target, name) {
    if (name === "createCollection") return (collection, options) => { definitions[collection] = options; };
    return target[name];
  }
});
function execute(name, database = db) {
  vm.runInNewContext(fs.readFileSync(path.join(folder, name), "utf8"), {
    db: database, use() {}, print() {}, NumberInt: n => n, Date
  }, { filename: name });
}
execute("script-collections.js");
execute("script-indexes.js");
execute("script-seed.js");
const location = definitions.weather_daily.validator.$jsonSchema.properties.location;
assert.deepEqual(Array.from(location.required), ["city", "state", "country"]);
assert.deepEqual(Array.from(location.dependencies.latitude), ["longitude"]);
assert.deepEqual(Array.from(location.dependencies.longitude), ["latitude"]);
assert.equal(location.properties.latitude.minimum, -90);
assert.equal(location.properties.latitude.maximum, 90);
assert.equal(location.properties.longitude.minimum, -180);
assert.equal(location.properties.longitude.maximum, 180);
for (const field of ["latitude", "longitude"]) {
  assert.deepEqual(Array.from(location.properties[field].bsonType), ["double", "int", "long", "decimal"]);
  const value = seeds.weather_daily[0].location[field];
  assert.equal(typeof value, "number");
  assert.ok(value >= location.properties[field].minimum && value <= location.properties[field].maximum);
}
assert.equal(indexes.idx_location_date_unique.key.weather_date, -1);
assert.equal(indexes.idx_location_date_unique.options.unique, true);
assert.equal(indexes.idx_weather_coordinates_date.options.unique, undefined);
assert.equal(indexes.idx_weather_coordinates_date.options.partialFilterExpression["location.latitude"].$type, "number");

const oldSchema = JSON.parse(JSON.stringify(definitions.weather_daily.validator));
delete oldSchema.$jsonSchema.properties.location.properties.latitude;
delete oldSchema.$jsonSchema.properties.location.properties.longitude;
delete oldSchema.$jsonSchema.properties.location.dependencies;
oldSchema.$jsonSchema.properties.custom_field = { bsonType: "string" };
let command;
const migratedIndexes = {};
const migrationDb = {
  getCollectionInfos() { return [{ options: { validator: oldSchema, validationLevel: "strict", validationAction: "warn" } }]; },
  runCommand(value) { command = value; return { ok: 1 }; },
  weather_daily: { createIndex(key, options) { migratedIndexes[options.name] = { key, options }; } }
};
const migrationContext = { getSiblingDB(name) { assert.equal(name, "db_delta_app"); return migrationDb; } };
execute("script-weather-location-update.js", migrationContext);
assert.equal(command.collMod, "weather_daily");
assert.equal(command.validationLevel, "strict");
assert.equal(command.validationAction, "warn");
assert.equal(command.validator.$jsonSchema.properties.custom_field.bsonType, "string");
assert.deepEqual(JSON.parse(JSON.stringify(command.validator.$jsonSchema.properties.location)), JSON.parse(JSON.stringify(location)));
assert.deepEqual(JSON.parse(JSON.stringify(migratedIndexes.idx_weather_coordinates_date)), JSON.parse(JSON.stringify(indexes.idx_weather_coordinates_date)));
execute("script-weather-location-update.js", migrationContext); // reexecutável
assert.throws(() => execute("script-weather-location-update.js", {
  getSiblingDB() { return { getCollectionInfos() { return []; } }; }
}), /não existe/);
console.log("OK: contrato, seed, índices e migração estrutural; nenhuma conexão ou carga executada.");
