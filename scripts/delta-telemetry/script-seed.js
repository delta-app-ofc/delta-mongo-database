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
    battery_level: 80,
    // Histórico simulado de 24 horas: 85.800 s online + 600 s offline.
    availability_started_at: new Date("2026-07-16T17:10:00Z"),
    availability_updated_at: new Date("2026-07-17T17:10:00Z"),
    available_seconds: NumberLong(85800),
    availability_is_mock: true,
    unavailabilities: [
      {
        started_at: new Date("2026-07-17T10:00:00Z"),
        ended_at: new Date("2026-07-17T10:10:00Z"),
        unavailable_seconds: NumberLong(600),
        unavailability_reason: "Perda de conexão Wi-Fi"
      }
    ]
  },
  {
    device_id: "ESP32-SP-0913",
    last_ping_at: new Date("2026-07-17T17:00:00Z"),
    wifi_signal_rssi: "weak",
    firmware_version: "v1.2.2",
    connectivity_status: "offline",
    unavailability_reason: "Sem alimentação elétrica",
    battery_level: 67,
    // Intervalo aberto: os segundos estão atualizados somente até 17:10Z.
    availability_started_at: new Date("2026-07-16T17:10:00Z"),
    availability_updated_at: new Date("2026-07-17T17:10:00Z"),
    available_seconds: NumberLong(85800),
    availability_is_mock: true,
    unavailabilities: [
      {
        started_at: new Date("2026-07-17T17:00:00Z"),
        ended_at: null,
        unavailable_seconds: NumberLong(600),
        unavailability_reason: "Sem alimentação elétrica"
      }
    ]
  }
]);

print("✓ 2 documentos inseridos em device_status");

// ─────────────────────────────────────────────────────────────────────────
// RESUMO
// ─────────────────────────────────────────────────────────────────────────

print("\n" + "=".repeat(70));
print("✅ Dados de seed inseridos com sucesso!");
print("=".repeat(70));
