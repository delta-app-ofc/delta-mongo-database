/**
 * Delta Project — MongoDB Collections Setup
 * 
 * Este script cria as coleções MongoDB para o Projeto Delta.
 * Siga a ordem: crie os dois databases antes de executar este script.
 * 
 * Uso:
 *   mongosh < script-collections.js
 *   ou
 *   mongosh atlas-connection-string --file script-collections.js
 */

/* global db, use */

// ============================================================================
// DATABASE: db_delta_telemetry
// ============================================================================

use("db_delta_telemetry");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: consumption_summary
// Descrição: Resumo consolidado de consumo por janela de 5 minutos
// Ciclo de vida: Permanente (sem TTL)
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("consumption_summary", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["device_id", "user_id", "window_started_at", "window_finished_at", "consumption_liters"],
      properties: {
        _id: { bsonType: "objectId" },
        device_id: { 
          bsonType: "string",
          description: "Identificador do dispositivo"
        },
        user_id: { 
          bsonType: "int",
          description: "ID do usuário dono do dispositivo (referência para PostgreSQL)"
        },
        window_started_at: { 
          bsonType: "date",
          description: "Início da janela de consumo"
        },
        window_finished_at: { 
          bsonType: "date",
          description: "Fim da janela de consumo"
        },
        consumption_liters: { 
          bsonType: "double",
          description: "Volume total consumido na janela"
        },
        lpm_average: { 
          bsonType: "double",
          description: "Vazão média em litros por minuto"
        },
        anomaly_detected: {
          bsonType: ["bool", "null"],
          description: "Resultado do detector: true/false, ou null quando não foi avaliada ou houve erro"
        },
        anomaly_reasons: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "Regras que sinalizaram a anomalia (ex.: continuous_flow, night_floor, robust_zscore)"
        },
        anomaly_evidence: {
          bsonType: "object",
          description: "Evidências da detecção (leituras, horários e baseline usado)"
        },
        detection_error: {
          bsonType: "string",
          description: "Motivo da falha do detector; preenchido junto com anomaly_detected = null"
        },
        detector_version: {
          bsonType: "string",
          description: "Versão do detector e da configuração que avaliou a janela"
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'consumption_summary' criada (db_delta_telemetry)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: device_status
// Descrição: Status único por dispositivo, atualizado via upsert
// Ciclo de vida: Permanente
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("device_status", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["device_id"],
      properties: {
        _id: { bsonType: "objectId" },
        device_id: { 
          bsonType: "string",
          description: "Identificador único do dispositivo"
        },
        last_ping_at: { 
          bsonType: "date",
          description: "Timestamp do último contato"
        },
        wifi_signal_rssi: {
          enum: ["excellent", "good", "weak", "critical", null],
          description: "Classificação do sinal Wi-Fi"
        },
        firmware_version: { 
          bsonType: "string",
          description: "Versão do firmware instalado"
        },
        connectivity_status: {
          enum: ["online", "offline", "unstable", null],
          description: "Status de conectividade"
        },
        unavailability_reason: { 
          bsonType: ["string", "null"],
          description: "Motivo do status offline/unstable"
        },
        battery_level: {
          bsonType: ["int", "null"],
          description: "Nível de bateria"
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'device_status' criada (db_delta_telemetry)");

print("\n✅ Todas as coleções foram criadas com sucesso!");
