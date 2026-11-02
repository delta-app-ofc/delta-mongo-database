/**
 * Delta Project — Migração do validator e dos índices de alerts_history
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
      required: ["user_id", "alert_type", "triggered_at"],
      properties: {
        _id: { bsonType: "objectId" },
        device_id: {
          bsonType: "string",
          description: "Dispositivo que originou o alerta (opcional: alertas gerais não têm dispositivo)"
        },
        user_id: {
          bsonType: "int",
          description: "Usuário notificado (referência ao ID do PostgreSQL)"
        },
        alert_type: {
          bsonType: "string",
          enum: ["vazamento_continuo", "fluxo_atipico", "consumo_fora_do_expediente", "mudanca_padrao",
                 "consumo_acima_esperado", "previsao_ultrapassagem_meta", "limite_ultrapassado",
                 "previsao_conta_disponivel", "tarifa_atualizada", "dica_personalizada",
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
        property_id: {
          bsonType: ["int", "null"],
          description: "Imóvel do alerta (referência ao ID do PostgreSQL); alertas gerais podem não ter"
        },
        title: {
          bsonType: "string",
          maxLength: 120,
          description: "Título curto exibido na tela de alertas"
        },
        message: {
          bsonType: "string",
          maxLength: 500,
          description: "Texto de apoio exibido abaixo do título"
        },
        source: {
          enum: ["detector", "gluh", "system"],
          description: "Quem gerou o alerta: detector (delta-api-mongo), gluh (IA) ou system (rotinas do sistema)"
        },
        dismissed_at: {
          bsonType: ["date", "null"],
          description: "Quando o usuário dispensou o alerta (botão X); null enquanto visível"
        },
        dedup_key: {
          bsonType: "string",
          description: "Chave de deduplicação: só um alerta aberto (resolved_at nulo) por chave"
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

print("✓ Validator de 'alerts_history' atualizado (novos alert_type e campos do contrato de alertas)");

// Índices do contrato de alertas (createIndex é idempotente; precisa de permissão de administrador).
db.alerts_history.createIndex(
  { dedup_key: 1 },
  {
    unique: true,
    partialFilterExpression: { dedup_key: { $type: "string" }, resolved_at: null },
    name: "idx_alerts_dedup_key_unique"
  }
);
db.alerts_history.createIndex(
  { user_id: 1, severity: 1, triggered_at: -1 },
  { name: "idx_user_severity_triggered_at_desc" }
);

print("✓ Índices de alerts_history criados (dedup_key único parcial e usuário + severidade)");
