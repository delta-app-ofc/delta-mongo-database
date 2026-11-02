/**
 * Delta Project — MongoDB Indexes Setup
 *
 * Este script cria todos os índices necessários para performance
 * das operações de leitura/escrita em produção.
 *
 * Execução: Execute este script APÓS script-collections.js
 *
 * Uso:
 *   mongosh < script-indexes.js
 */

/* global db, use */

// ============================================================================
// DATABASE: db_delta_app
// ============================================================================

use("db_delta_app");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: user_preferences
// ─────────────────────────────────────────────────────────────────────────

// Índice único: user_id
// Justificativa: Um documento de preferências por usuário.
// O sistema lê este documento a cada pacote de telemetria processado
// para checar quiet_hours. Unicidade previne duplicatas.
db.user_preferences.createIndex(
  { user_id: 1 },
  { unique: true, name: "idx_user_id_unique" }
);

print("✓ Índice ÚNICO criado em user_preferences (user_id)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: alerts_history
// ─────────────────────────────────────────────────────────────────────────

// Índice composto: user_id + triggered_at (descendente)
// Justificativa: Alimenta a tela de notificações do app, sempre lida
// por usuário e ordenada por data recente. Uma das queries mais frequentes.
db.alerts_history.createIndex(
  { user_id: 1, triggered_at: -1 },
  { name: "idx_user_triggered_at_desc" }
);

print("✓ Índice composto criado em alerts_history (user_id + triggered_at DESC)");

// Índice composto parcial: device_id + resolved_at (alertas ativos)
// Justificativa: Localiza rapidamente alertas ainda não resolvidos por dispositivo
// sem varrer o histórico já resolvido. Usa partial filter (resolved_at = null).
// Nota: MongoDB suporta partial indexes via filterExpression
db.alerts_history.createIndex(
  { device_id: 1, resolved_at: 1 },
  {
    partialFilterExpression: { resolved_at: null },
    name: "idx_device_unresolved_alerts"
  }
);

print("✓ Índice composto PARCIAL criado em alerts_history (device_id + resolved_at para alertas ativos)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: user_hour_baseline
// ─────────────────────────────────────────────────────────────────────────

// Índice único: device_id + hour_of_week
// Justificativa: Garante um documento por dispositivo e slot da semana (168 slots)
// e serve de chave para o upsert do detector a cada janela de consumo.
db.user_hour_baseline.createIndex(
  { device_id: 1, hour_of_week: 1 },
  { unique: true, name: "idx_device_hour_of_week_unique" }
);

print("✓ Índice único criado em user_hour_baseline (device_id + hour_of_week)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: chat_sessions
// ─────────────────────────────────────────────────────────────────────────

// Índice composto: user_id + last_activity_at (descendente)
// Justificativa: Lista de "atendimentos anteriores" do usuário,
// ordenada por atividade recente. Interface do app.
db.chat_sessions.createIndex(
  { user_id: 1, last_activity_at: -1 },
  { name: "idx_user_activity_desc" }
);

print("✓ Índice composto criado em chat_sessions (user_id + last_activity_at DESC)");

// Índice composto: user_id + is_open (sesões abertas)
// Justificativa: Localiza rapidamente uma sessão em aberto para decidir
// entre reabrir ou criar uma nova. Reduz varreduras.
db.chat_sessions.createIndex(
  { user_id: 1, is_open: 1 },
  { name: "idx_user_open_sessions" }
);

print("✓ Índice composto criado em chat_sessions (user_id + is_open)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: chat_feedback
// ─────────────────────────────────────────────────────────────────────────

// Índice simples: session_id
// Justificativa: Suporta o cruzamento (via $lookup em agregação) entre
// sessão e sua avaliação, usado em métricas de satisfação do bot.
db.chat_feedback.createIndex(
  { session_id: 1 },
  { name: "idx_session_id" }
);

print("✓ Índice simples criado em chat_feedback (session_id)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: weather_daily
// ─────────────────────────────────────────────────────────────────────────

// Índice composto único: país + estado + cidade + data
// Justificativa: Garante apenas um documento diário por localização
// e otimiza consultas históricas de clima por cidade e período.
//
// Padrão:
// db.weather_daily.find({
//   "location.country": "BR",
//   "location.state": "SP",
//   "location.city": "São Paulo",
//   weather_date: {
//     $gte: new Date("2026-09-01T00:00:00Z"),
//     $lte: new Date("2026-09-30T00:00:00Z")
//   }
// }).sort({ date: -1 })

db.weather_daily.createIndex(
  {
    "location.country": 1,
    "location.state": 1,
    "location.city": 1,
    weather_date: -1
  },
  {
    unique: true,
    name: "idx_location_date_unique"
  }
);

print("✓ Índice único criado em weather_daily (country + state + city + date)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: observability_requests
// ─────────────────────────────────────────────────────────────────────────

// TTL: apaga os registros 90 dias depois de created_at.
// Justificativa: o painel só olha as últimas semanas; sem expiração a coleção cresceria sem limite.
db.observability_requests.createIndex(
  { created_at: 1 },
  { expireAfterSeconds: 7776000, name: "idx_created_at_ttl_90d" }
);

print("✓ Índice TTL criado em observability_requests (created_at, 90 dias)");

// Único: request_id
// Justificativa: uma linha por requisição; evita duplicar se a gravação for repetida.
db.observability_requests.createIndex(
  { request_id: 1 },
  { unique: true, name: "idx_request_id_unique" }
);

print("✓ Índice ÚNICO criado em observability_requests (request_id)");

// Composto: client + created_at (descendente)
// Justificativa: custo e uso por canal (app, web, playground) numa janela de tempo.
db.observability_requests.createIndex(
  { client: 1, created_at: -1 },
  { name: "idx_client_created_at_desc" }
);

print("✓ Índice composto criado em observability_requests (client + created_at DESC)");

// Composto parcial: user_hash + created_at
// Justificativa: contar usuários distintos por semana e perguntas por usuário.
db.observability_requests.createIndex(
  { user_hash: 1, created_at: -1 },
  { partialFilterExpression: { user_hash: { $exists: true } }, name: "idx_user_hash_created_at_desc" }
);

print("✓ Índice composto parcial criado em observability_requests (user_hash + created_at DESC)");

print("✅ Todos os índices foram criados com sucesso!");
