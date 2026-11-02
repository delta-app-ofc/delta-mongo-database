/**
 * Delta Project — Migração dos campos de anomalia em consumption_summary
 *
 * Para instalações que JÁ têm a coleção criada: db.createCollection() não altera uma coleção
 * existente, então o validator antigo continuaria rejeitando anomaly_detected: null (erro 121).
 * Este script aplica o validator novo com collMod, sem apagar nem reescrever documentos.
 *
 * Em instalações novas ele é desnecessário (script-collections.js já cria o validator atualizado),
 * mas pode ser executado de novo sem efeito colateral.
 *
 * Uso:
 *   mongosh atlas-connection-string --file script-migrate-anomaly-fields.js
 */

/* global db, use */

use("db_delta_telemetry");

db.runCommand({
  collMod: "consumption_summary",
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
          description: "Evidências da detecção (leituras, horários e baseline usados)"
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

print("✓ Validator de 'consumption_summary' atualizado (campos de anomalia)");
