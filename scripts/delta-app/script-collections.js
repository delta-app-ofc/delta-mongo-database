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
// DATABASE: db_delta_app
// ============================================================================

use("db_delta_app");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: user_preferences
// Descrição: Preferências por usuário (metas, horários de silêncio, etc.)
// Ciclo de vida: Permanente
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("user_preferences", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "dark_mode_enabled"],
      properties: {
        _id: { bsonType: "objectId" },
        user_id: {
          bsonType: "int",
          description: "Referência ao usuário (ID do PostgreSQL)"
        },
        daily_liters_target: {
          bsonType: "int",
          description: "Meta diária de consumo em litros"
        },
        notifications_enabled: {
          bsonType: "bool",
          description: "Ativa/desativa push notifications"
        },
        quiet_hours: {
          bsonType: "object",
          description: "Janela de horário silencioso",
          properties: {
            start_hour: {
              bsonType: "string",
              description: "Horário da abertura da janela de silenciamento de notificações"
            },
            end_hour: {
              bsonType: "string",
              description: "Horário da encerramento da janela de silenciamento de notificações"
            }
          }
        },
        dark_mode_enabled: {
          bsonType: "bool",
          description: "Preferência visual do app"
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'user_preferences' criada (db_delta_app)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: alerts_history
// Descrição: Registro de alertas disparados pela IA
// Ciclo de vida: Permanente
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("alerts_history", {
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
          enum: ["vazamento_continuo", "fluxo_atipico", "dispositivo_offline", "leitura_impossivel"],
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
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'alerts_history' criada (db_delta_app)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: chat_sessions
// Descrição: Sessões de chat com array de mensagens embutido (padrão Bucket)
// Ciclo de vida: Permanente
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("chat_sessions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["user_id", "started_at"],
      properties: {
        _id: { bsonType: "objectId" },
        user_id: {
          bsonType: "int",
          description: "Usuário dono da sessão (referência ao ID do PostgreSQL)"
        },
        started_at: {
          bsonType: "date",
          description: "Início da sessão"
        },
        last_activity_at: {
          bsonType: "date",
          description: "Última interação"
        },
        is_open: {
          bsonType: "bool",
          description: "Sessão aceita novas mensagens"
        },
        is_active: {
          bsonType: "bool",
          description: "Sessão em atendimento agora"
        },
        is_deleted: {
          bsonType: "bool",
          description: "Soft delete (não remove o documento)"
        },
        messages: {
          bsonType: "array",
          description: "Mensagens da sessão (máx. 50-100)",
          items: {
            bsonType: "object",
            required: ["role", "content_type", "content", "api_status_code"],
            properties: {
              role: {
                enum: ["user", "bot"],
                description: "Remetente da mensagem: user -> usuário do app / bot: o modelo de IA"
              },
              content_type: {
                bsonType: "string",
                enum: ["text", "function"],
                description: "Tipo de conteúdo da mensagem: texto ou chamada de função"
              },
              content: {
                bsonType: "string",
                description: "Conteúdo da mensagem na íntegra (texto ou JSON de função)"
              },
              sent_at: {
                bsonType: "date",
                description: "Horário de envio da mensagem"
              },
              api_status_code: {
                bsonType: "int",
                description: "Código do status enviado pela API"
              }
            }
          }
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'chat_sessions' criada (db_delta_app)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: chat_feedback
// Descrição: Avaliações de sessões (referência lógica a chat_sessions)
// Ciclo de vida: Permanente
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("chat_feedback", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["session_id", "is_satisfied"],
      properties: {
        _id: { bsonType: "objectId" },
        session_id: {
          bsonType: "objectId",
          description: "Referência a chat_sessions._id"
        },
        is_satisfied: {
          bsonType: "bool",
          description: "Avaliação binária (true = 👍, false = 👎)"
        },
        user_comment: {
          bsonType: ["string", "null"],
          description: "Feedback livre do usuário"
        },
        created_at: {
          bsonType: "date",
          description: "Timestamp do feedback"
        }
      }
    }
  },
  validationLevel: "moderate"
});

print("✓ Coleção 'chat_feedback' criada (db_delta_app)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: weather_daily
// Descrição: Dados meteorológicos horários agrupados por dia e localização
// Ciclo de vida: Permanente; fonte histórica da verdade para dados climáticos
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("weather_daily", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "location",
        "hours",
        "samples",
        "created_at"
      ],
      properties: {
        _id: {
          bsonType: "objectId"
        },

        location: {
          bsonType: "object",
          required: [
            "city",
            "state",
            "country"
          ],
          properties: {
            city: {
              bsonType: "string",
              description: "Cidade referente aos dados meteorológicos"
            },
            state: {
              bsonType: "string",
              description: "Estado ou unidade federativa da localização"
            },
            country: {
              bsonType: "string",
              description: "Código do país da localização"
            }
          }
        },

        weather_date: {
          bsonType: "date",
          description: "Data de referência do documento, normalizada para o início do dia"
        },

        hours: {
          bsonType: "array",
          description: "Observações meteorológicas coletadas ao longo do dia",
          maxItems: 24,
          items: {
            bsonType: "object",
            required: [
              "hour",
              "observed_at",
              "temperature_c",
              "feels_like_c",
              "humidity_percent",
              "rain_mm",
              "wind_speed_mps",
              "condition"
            ],
            properties: {
              hour: {
                bsonType: "int",
                minimum: 0,
                maximum: 23,
                description: "Hora da observação, entre 0 e 23"
              },

              observed_at: {
                bsonType: "date",
                description: "Timestamp correspondente à observação meteorológica"
              },

              temperature_c: {
                bsonType: ["double", "int", "long", "decimal"],
                description: "Temperatura observada em graus Celsius"
              },

              feels_like_c: {
                bsonType: ["double", "int", "long", "decimal"],
                description: "Sensação térmica em graus Celsius"
              },

              humidity_percent: {
                bsonType: ["int", "long", "double", "decimal"],
                minimum: 0,
                maximum: 100,
                description: "Umidade relativa do ar em percentual"
              },

              rain_mm: {
                bsonType: ["double", "int", "long", "decimal"],
                minimum: 0,
                description: "Volume de chuva registrado em milímetros"
              },

              wind_speed_mps: {
                bsonType: ["double", "int", "long", "decimal"],
                minimum: 0,
                description: "Velocidade do vento em metros por segundo"
              },

              condition: {
                bsonType: "string",
                description: "Condição meteorológica principal da observação"
              }
            }
          }
        },

        samples: {
          bsonType: "int",
          minimum: 0,
          maximum: 24,
          description: "Quantidade de observações horárias armazenadas no documento"
        },

        created_at: {
          bsonType: "date",
          description: "Timestamp de criação do documento diário"
        },

        updated_at: {
          bsonType: "date",
          description: "Timestamp da atualização mais recente do documento diário"
        }
      }
    }
  },

  validationLevel: "moderate"
});

print("✓ Coleção 'weather_daily' criada (db_delta_app)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: observability_requests
// Descrição: Uma linha por requisição de chat da API de IA, com custo, tokens,
//            latência por etapa e resultado. Não guarda pergunta, resposta nem user_id.
// Ciclo de vida: Temporário (TTL de 90 dias em created_at)
// ─────────────────────────────────────────────────────────────────────────

db.createCollection("observability_requests", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["request_id", "created_at", "mode", "outcome", "total_ms", "cost_usd"],
      properties: {
        _id: { bsonType: "objectId" },

        request_id: {
          bsonType: "string",
          description: "Identificador da requisição (o mesmo do cabeçalho X-Request-ID)"
        },

        created_at: {
          bsonType: "date",
          description: "Momento em que a requisição terminou; base do TTL"
        },

        mode: {
          enum: ["chat", "judge"],
          description: "Fluxo executado: chat completo ou fluxo com o Juiz"
        },

        client: {
          enum: ["app", "web", "playground", "unknown"],
          description: "Cliente que chamou a API (cabeçalho X-Client); permite comparar o custo por canal"
        },

        user_hash: {
          bsonType: "string",
          description: "HMAC do user_id com segredo do servidor; só conta usuários distintos, não é reversível"
        },

        outcome: {
          enum: ["success", "partial", "error", "rejected"],
          description: "Resultado da requisição"
        },

        resolved: {
          bsonType: "bool",
          description: "Verdadeiro quando a resposta foi publicada sem erro e sem bloqueio do Juiz"
        },

        total_ms: {
          bsonType: "number",
          minimum: 0,
          description: "Tempo total da requisição em milissegundos"
        },

        overhead_ms: {
          bsonType: "number",
          minimum: 0,
          description: "Tempo fora das etapas do grafo (orquestração) em milissegundos"
        },

        nodes_ms: {
          bsonType: "object",
          description: "Tempo por etapa do grafo, em milissegundos"
        },

        agents_ms: {
          bsonType: "object",
          description: "Tempo por agente especialista, em milissegundos"
        },

        revisions: {
          bsonType: "int",
          minimum: 0,
          description: "Quantidade de correções pedidas pelo Juiz"
        },

        input_tokens: { bsonType: "number", minimum: 0, description: "Tokens de entrada dos modelos de chat" },
        output_tokens: { bsonType: "number", minimum: 0, description: "Tokens de saída dos modelos de chat" },
        embedding_tokens: { bsonType: "number", minimum: 0, description: "Tokens dos embeddings, contados pelo count_tokens do Google" },
        embedding_uncounted: { bsonType: "int", minimum: 0, description: "Chamadas de embedding sem contagem de tokens; o custo delas não é estimado" },
        jev_tokens: { bsonType: "number", minimum: 0, description: "Tokens de entrada do Jev, devolvidos pela API" },
        model_calls: { bsonType: "int", minimum: 0, description: "Chamadas aos modelos de chat" },
        fallback_calls: { bsonType: "int", minimum: 0, description: "Chamadas feitas ao modelo reserva" },

        by_component: {
          bsonType: "object",
          description: "Chamadas, tokens, tempo de modelo e custo por componente do grafo"
        },

        llm_cost_usd: { bsonType: "number", minimum: 0, description: "Custo estimado dos modelos de chat em USD" },
        embedding_cost_usd: { bsonType: "number", minimum: 0, description: "Custo dos embeddings em USD, a partir dos tokens contados" },
        jev_cost_usd: { bsonType: "number", minimum: 0, description: "Custo do Jev em USD, a partir dos tokens devolvidos pela API" },
        cost_usd: { bsonType: "number", minimum: 0, description: "Custo total estimado em USD" },

        unpriced_models: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "Modelos usados que não tinham preço cadastrado"
        }
      }
    }
  },

  validationLevel: "moderate"
});

print("✓ Coleção 'observability_requests' criada (db_delta_app)");

print("\n✅ Todas as coleções foram criadas com sucesso!");
