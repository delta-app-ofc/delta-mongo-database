/**
 * Delta Project — Migração dos tipos e campos de alerts_history
 *
 * Para instalações que JÁ têm a coleção criada: db.createCollection() não altera uma coleção
 * existente, então o validator antigo continuaria rejeitando os novos alert_type (erro 121).
 * Este script aplica o validator novo com collMod, sem apagar nem reescrever documentos.
 *
 * Em instalações novas ele é desnecessário (script-collections.js já cria o validator atualizado),
 * mas pode ser executado de novo sem efeito colateral.
 *
 * Uso:
 *   mongosh atlas-connection-string --file script-migrate-alert-types.js
 */

/* global db, use */

use("db_delta_app");

db.runCommand({
  collMod: "alerts_history",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["device_id", "user_id", "alert_type", "triggered_at"],
      properties: {
        _id: { bsonType: "objectId" },
        device_id: {
          bsonType: "string",
          description: "Dispositivo que originou o alerta"
        },
        user_id: {
          bsonType: "int",
          description: "Usuário notificado (referência ao ID do PostgreSQL)"
        },
        alert_type: {
          bsonType: "string",
          enum: ["vazamento_continuo", "fluxo_atipico", "consumo_fora_do_expediente", "mudanca_padrao",
                 "dispositivo_offline", "leitura_impossivel"],
          description: "Tipo de anomalia detectada"
        },
        triggered_at: {
          bsonType: "date",
          description: "Momento de abertura do alerta"
        },
        resolved_at: {
          bsonType: ["date", "null"],
          description: "Momento de resolução (null enquanto ativo)"
        },
        severity: {
          enum: ["low", "medium", "high", null],
          description: "Nível de severidade"
        },
        rule: {
          bsonType: "string",
          description: "Regra do detector que abriu o alerta (ex.: continuous_flow, night_floor, robust_zscore)"
        },
        evidence: {
          bsonType: "object",
          description: "Evidências da detecção (leituras, horários e baseline usado)"
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Validator de 'alerts_history' atualizado (novos alert_type e campos do detector)");
