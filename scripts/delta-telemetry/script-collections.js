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
          bsonType: "bool",
          description: "Flag setada pela IA para anomalias"
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
      dependencies: {
        available_seconds: ["availability_started_at", "availability_updated_at", "unavailabilities"],
        availability_started_at: ["available_seconds"],
        availability_updated_at: ["available_seconds"],
        unavailabilities: ["available_seconds"]
      },
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
        battery_level: {
          bsonType: ["int", "null"],
          description: "Nível de bateria"
        },
        availability_started_at: {
          bsonType: "date",
          description: "Início do período coberto pelo contador e pelas indisponibilidades"
        },
        availability_updated_at: {
          bsonType: "date",
          description: "Instante até o qual os tempos foram contabilizados pelo backend"
        },
        available_seconds: {
          bsonType: ["int", "long"],
          minimum: 0,
          description: "Tempo online acumulado, em segundos, no período de disponibilidade"
        },
        unavailabilities: {
          bsonType: "array",
          description: "Intervalos de indisponibilidade contabilizados no mesmo período",
          items: {
            bsonType: "object",
            required: ["started_at", "ended_at", "unavailable_seconds", "unavailability_reason"],
            properties: {
              started_at: { bsonType: "date" },
              ended_at: {
                bsonType: ["date", "null"],
                description: "null enquanto a indisponibilidade estiver aberta"
              },
              unavailable_seconds: {
                bsonType: ["int", "long"],
                minimum: 0,
                description: "Segundos até ended_at, ou availability_updated_at quando aberta"
              },
              unavailability_reason: {
                bsonType: ["string", "null"],
                description: "Motivo do intervalo; null quando desconhecido"
              }
            }
          }
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'device_status' criada (db_delta_telemetry)");

print("\n✅ Todas as coleções foram criadas com sucesso!");
