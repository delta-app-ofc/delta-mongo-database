/** Cria o baseline com validator antes dos índices, ou atualiza o validator preservando documentos.
 * Execute com uma credencial administrativa no cluster de db_delta_app. Pode ser repetido.
 */
/* global db, use */
use("db_delta_app");

const baselineOptions = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["device_id", "hour_of_week", "count"],
      properties: {
        _id: { bsonType: "objectId" },
        device_id: {
          bsonType: "string",
          description: "Dispositivo (medidor) ao qual o baseline pertence"
        },
        property_id: {
          bsonType: ["int", "null"],
          description: "Imóvel do dispositivo (referência ao ID do PostgreSQL), quando conhecido"
        },
        hour_of_week: {
          bsonType: "int",
          minimum: -1,
          maximum: 167,
          description: "Hora da semana no fuso do imóvel (America/Sao_Paulo): 0 = segunda 00h, 167 = domingo 23h; -1 = documento de estado do dispositivo (regime e CUSUM)"
        },
        median: {
          bsonType: ["double", "null"],
          description: "Mediana dos litros por janela neste slot"
        },
        mad: {
          bsonType: ["double", "null"],
          description: "Desvio absoluto mediano (MAD) dos litros por janela neste slot"
        },
        ewma_mean: {
          bsonType: ["double", "null"],
          description: "Média móvel exponencial (baseline rápido)"
        },
        ewma_var: {
          bsonType: ["double", "null"],
          description: "Variância móvel exponencial (baseline rápido)"
        },
        count: {
          bsonType: "int",
          minimum: 0,
          description: "Quantidade de janelas aceitas no baseline deste slot"
        },
        night_floor_lpm: {
          bsonType: ["double", "null"],
          description: "Piso de vazão noturna (00h–05h) em litros por minuto"
        },
        min_flow_median: {
          bsonType: ["double", "null"],
          description: "Mediana da vazão mínima das janelas, usada como piso do regime"
        },
        regime_state: {
          enum: ["NORMAL", "CANDIDATE", "SHIFTED", "RETURNING"],
          description: "Estado do rastreador de mudança de regime"
        },
        regime_since: {
          bsonType: ["date", "null"],
          description: "Início do estado de regime atual"
        },
        cusum_pos: {
          bsonType: ["double", "null"],
          description: "Soma acumulada positiva (Page-Hinkley/CUSUM) para degrau de aumento"
        },
        cusum_neg: {
          bsonType: ["double", "null"],
          description: "Soma acumulada negativa (Page-Hinkley/CUSUM) para degrau de queda"
        },
        last_window_finished_at: {
          bsonType: ["date", "null"],
          description: "Fim da última janela processada; janelas mais antigas não alteram o baseline"
        },
        config_version: {
          bsonType: "string",
          description: "Versão da configuração do detector que gerou o baseline"
        },
        updated_at: {
          bsonType: "date",
          description: "Última atualização do documento"
        },
        slow_ready: {
          bsonType: "bool",
          description: "Referência lenta consolidada por promoção, utilizável enquanto o histórico é reconstruído"
        },
        samples: {
          bsonType: "array",
          items: { bsonType: "double" },
          description: "Últimos litros por janela aceitos no slot (base da mediana e do MAD)"
        },
        rule_state: {
          bsonType: "object",
          description: "Contadores das regras no estado do dispositivo (confirmação, encerramento de alerta, direção do regime)"
        },
        regime_acc: {
          bsonType: "object",
          description: "Soma da hora em andamento usada pelo rastreador de regime"
        },
        visit_until: {
          bsonType: ["date", "null"],
          description: "Parâmetro opcional e auditável: até quando uma mudança de regime vale como visita declarada"
        }
      }
    }
  },
  validationLevel: "moderate"
};
if (db.getCollectionInfos({ name: "user_hour_baseline" }).length === 0) {
  db.createCollection("user_hour_baseline", baselineOptions);
} else {
  db.runCommand({ collMod: "user_hour_baseline", ...baselineOptions });
}
print("✓ user_hour_baseline criada/atualizada com validator, preservando os dados");
