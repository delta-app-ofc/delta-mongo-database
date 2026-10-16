// Verificação estrutural e aritmética das fixtures; não substitui MongoDB real.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const definitions = {};
const seeds = {};
const plain = value => JSON.parse(JSON.stringify(value));
const database = new Proxy({}, {
  get(_, name) {
    if (name === "createCollection") return (collection, options) => {
      definitions[collection] = plain(options.validator.$jsonSchema);
    };
    return {
      insertMany(docs) { seeds[name] = docs; },
      insertOne(doc) { seeds[name] = [doc]; },
      findOne() { return { _id: "test-session" }; }
    };
  }
});
function execute(file, db = database) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), {
    db, use() {}, print() {}, NumberInt: Number, NumberLong: Number, Date
  }, { filename: file });
}
for (const folder of ["delta-app", "delta-telemetry"]) {
  execute(`scripts/${folder}/script-collections.js`);
  execute(`scripts/${folder}/script-seed.js`);
}

for (const message of seeds.chat_sessions.flatMap(session => session.messages)) {
  if (message.role === "user") {
    assert.equal(message.agent_name, undefined);
  } else {
    assert.ok(message.agent_name && !["judge", "router"].includes(message.agent_name));
    assert.ok(Number.isInteger(message.response_time_ms) && message.response_time_ms >= 0);
    assert.equal(message.response_time_is_mock, undefined);
  }
}
assert.equal(seeds.device_status.length, 2);
assert.ok(seeds.device_status.some(device => device.unavailabilities.some(event => event.ended_at === null)));
for (const device of seeds.device_status) {
  assert.equal(device.availability_is_mock, undefined);
  assert.equal(device.unavailability_reason, undefined);
  const start = device.availability_started_at;
  const cut = device.availability_updated_at;
  let previousEnd = start;
  let downtime = 0;
  for (const event of device.unavailabilities) {
    const end = event.ended_at || cut;
    assert.ok(event.started_at >= previousEnd && end >= event.started_at && end <= cut);
    assert.equal(event.unavailable_seconds, (end - event.started_at) / 1000);
    previousEnd = end;
    downtime += event.unavailable_seconds;
  }
  assert.equal(device.available_seconds + downtime, (cut - start) / 1000);
}

// Simula validadores antigos com regras extras que a migração deve preservar.
const oldChat = plain(definitions.chat_sessions);
const oldDevice = plain(definitions.device_status);
const chatMetrics = ["agent_name", "response_time_ms"];
const deviceMetrics = ["available_seconds", "availability_started_at", "availability_updated_at", "unavailabilities"];
for (const key of chatMetrics) delete oldChat.properties.messages.items.properties[key];
delete oldChat.properties.messages.items.dependencies;
for (const key of deviceMetrics) delete oldDevice.properties[key];
delete oldDevice.dependencies;
oldChat.properties.messages.items.properties.response_time_is_mock = { bsonType: "bool" };
oldDevice.properties.availability_is_mock = { bsonType: "bool" };
oldDevice.properties.unavailability_reason = { bsonType: ["string", "null"] };
oldChat.properties.custom_field = { bsonType: "string" };
oldChat.properties.messages.items.dependencies = { custom_message: ["role"] };
oldDevice.dependencies = { custom_device: ["device_id"] };
const options = {
  chat_sessions: { validator: { $jsonSchema: oldChat }, validationLevel: "moderate", validationAction: "error" },
  device_status: { validator: { $jsonSchema: oldDevice }, validationLevel: "strict", validationAction: "warn" }
};
let commands = [];
let missing = false;
const migrationDb = {
  getSiblingDB(name) {
    assert.ok(["db_delta_app", "db_delta_telemetry"].includes(name));
    return {
      getCollectionInfos({ name: collection }) {
        return missing && collection === "device_status" ? [] : [{ options: plain(options[collection]) }];
      },
      runCommand(command) {
        commands.push(plain(command));
        options[command.collMod] = plain(command);
        return { ok: 1 };
      }
    };
  }
};
const migration = "scripts/script-bi-metrics-update.js";
execute(migration, migrationDb);
const firstRun = plain(commands);
for (const command of commands) {
  const schema = command.validator.$jsonSchema;
  if (command.collMod === "chat_sessions") {
    for (const key of chatMetrics) assert.deepEqual(schema.properties.messages.items.properties[key], definitions.chat_sessions.properties.messages.items.properties[key]);
    assert.deepEqual(schema.properties.custom_field, { bsonType: "string" });
    assert.deepEqual(schema.properties.messages.items.dependencies.custom_message, ["role"]);
    for (const key of chatMetrics) assert.deepEqual(schema.properties.messages.items.dependencies[key], definitions.chat_sessions.properties.messages.items.dependencies[key]);
    assert.equal(schema.properties.messages.items.properties.response_time_is_mock, undefined);
    assert.equal(command.validationLevel, "moderate");
  } else {
    for (const key of deviceMetrics) assert.deepEqual(schema.properties[key], definitions.device_status.properties[key]);
    assert.deepEqual(schema.dependencies.custom_device, ["device_id"]);
    for (const key of deviceMetrics) assert.deepEqual(schema.dependencies[key], definitions.device_status.dependencies[key]);
    assert.equal(schema.properties.availability_is_mock, undefined);
    assert.equal(schema.properties.unavailability_reason, undefined);
    assert.equal(command.validationAction, "warn");
  }
}
commands = [];
execute(migration, migrationDb);
assert.deepEqual(commands, firstRun, "migration is idempotent");
commands = [];
missing = true;
assert.throws(() => execute(migration, migrationDb), /não encontrado/);
assert.equal(commands.length, 0, "preflight failure does not write either validator");
console.log("OK: mocks coerentes, contrato e migração estrutural; nenhum MongoDB acessado.");
