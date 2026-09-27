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
        "date",
        "hours",
        "samples",
        "created_at",
        "updated_at"
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
            "country",
            "latitude",
            "longitude"
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
            },
            latitude: {
              bsonType: ["double", "int", "long", "decimal"],
              minimum: -90,
              maximum: 90,
              description: "Latitude da localização"
            },
            longitude: {
              bsonType: ["double", "int", "long", "decimal"],
              minimum: -180,
              maximum: 180,
              description: "Longitude da localização"
            }
          }
        },

        date: {
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
              "pressure_hpa",
              "rain_mm",
              "cloud_coverage_percent",
              "wind_speed_m_s",
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

              pressure_hpa: {
                bsonType: ["int", "long", "double", "decimal"],
                description: "Pressão atmosférica em hectopascais"
              },

              rain_mm: {
                bsonType: ["double", "int", "long", "decimal"],
                minimum: 0,
                description: "Volume de chuva registrado em milímetros"
              },

              cloud_coverage_percent: {
                bsonType: ["int", "long", "double", "decimal"],
                minimum: 0,
                maximum: 100,
                description: "Percentual de cobertura de nuvens"
              },

              wind_speed_m_s: {
                bsonType: ["double", "int", "long", "decimal"],
                minimum: 0,
                description: "Velocidade do vento em metros por segundo"
              },

              wind_gust_m_s: {
                bsonType: ["double", "int", "long", "decimal", "null"],
                minimum: 0,
                description: "Velocidade das rajadas de vento em metros por segundo"
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

print("\n✅ Todas as coleções foram criadas com sucesso!");