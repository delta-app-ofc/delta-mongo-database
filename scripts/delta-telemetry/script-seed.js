/**
 * Delta Project — MongoDB Seed Data
 * 
 * Este script insere dados iniciais de teste/exemplo para validar
 * a estrutura do banco em ambiente de desenvolvimento.
 * 
 * ⚠️  NÃO execute em produção!
 * 
 * Execução:
 *   mongosh < script-seed.js
 */

/* global db, use, NumberInt, NumberLong */

use("db_delta_telemetry");

// ─────────────────────────────────────────────────────────────────────────
// Seed: consumption_summary
// ─────────────────────────────────────────────────────────────────────────

db.consumption_summary.insertMany([
  {
    device_id: "ESP32-SP-0912",
    user_id: NumberInt(212),
    window_started_at: new Date("2026-07-17T17:05:00Z"),
    window_finished_at: new Date("2026-07-17T17:10:00Z"),
    consumption_liters: 14,
    lpm_average: 2.8,
    anomaly_detected: false
  },
  {
    device_id: "ESP32-SP-0913",
    user_id: NumberInt(213),
    window_started_at: new Date("2026-07-17T17:05:00Z"),
    window_finished_at: new Date("2026-07-17T17:10:00Z"),
    consumption_liters: 8,
    lpm_average: 1.6,
    anomaly_detected: false
  }
]);

print("✓ 2 documentos inseridos em consumption_summary");

// ─────────────────────────────────────────────────────────────────────────
// Seed: device_status
// ─────────────────────────────────────────────────────────────────────────

db.device_status.insertMany([
  {
    device_id: "ESP32-SP-0912",
    last_ping_at: new Date("2026-07-17T17:10:00Z"),
    wifi_signal_rssi: "good",
    firmware_version: "v1.2.3",
    connectivity_status: "online",
    unavailability_reason: null,
    battery_level: 80
  },
  {
    device_id: "ESP32-SP-0913",
    last_ping_at: new Date("2026-07-17T17:09:50Z"),
    wifi_signal_rssi: "weak",
    firmware_version: "v1.2.2",
    connectivity_status: "online",
    unavailability_reason: null,
    battery_level: 67
  }
]);

print("✓ 2 documentos inseridos em device_status");

// ─────────────────────────────────────────────────────────────────────────
// RESUMO
// ─────────────────────────────────────────────────────────────────────────

print("\n" + "=".repeat(70));
print("✅ Dados de seed inseridos com sucesso!");
print("=".repeat(70));
