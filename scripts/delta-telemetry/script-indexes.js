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
// DATABASE: db_delta_telemetry
// ============================================================================

use("db_delta_telemetry");


// ─────────────────────────────────────────────────────────────────────────
// Coleção: consumption_summary
// ─────────────────────────────────────────────────────────────────────────

// Índice composto CRÍTICO: user_id + window_started_at (descendente)
// Justificativa: Sustenta a leitura do histórico/gráfico de consumo do app.
// É a query mais frequente e deve ser instantânea.
// Padrão: db.consumption_summary.find({ user_id: "...", window_started_at: { $gte: ... } }).sort({ window_started_at: -1 })
db.consumption_summary.createIndex(
  { user_id: 1, window_started_at: -1 },
  { name: "idx_user_window_time" }
);

print("✓ Índice composto criado em consumption_summary (user_id + window_started_at DESC)");

// Índice simples: device_id
// Justificativa: Consultas administrativas/suporte por dispositivo,
// independente do usuário.
db.consumption_summary.createIndex(
  { device_id: 1 },
  { name: "idx_device" }
);

print("✓ Índice simples criado em consumption_summary (device_id)");

// ─────────────────────────────────────────────────────────────────────────
// Coleção: device_status
// ─────────────────────────────────────────────────────────────────────────

// Índice único: device_id
// Justificativa: A coleção segue padrão upsert (um documento por dispositivo).
// O índice único é o que garante essa unicidade e viabiliza
// updateOne({ device_id }, ..., { upsert: true }) sem duplicatas.
db.device_status.createIndex(
  { device_id: 1 },
  { unique: true, name: "idx_device_id_unique" }
);

print("✓ Índice ÚNICO criado em device_status (device_id)");

print("✅ Todos os índices foram criados com sucesso!");
