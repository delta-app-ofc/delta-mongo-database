/**
 * Delta Project — MongoDB Seed Data
 * 
 * Este script insere dados iniciais de teste/exemplo para validar
 * a estrutura do banco em ambiente de desenvolvimento.
 * 
 * ⚠️  NÃO execute em produção!
 * 
 * Execução:
 *   mongosh < script-seed.js
 */

/* global db, use, NumberInt */

use("db_delta_app");

// ─────────────────────────────────────────────────────────────────────────
// Seed: user_preferences
// ─────────────────────────────────────────────────────────────────────────

db.user_preferences.insertMany([
  {
    user_id: NumberInt(212),
    daily_liters_target: NumberInt(300),
    notifications_enabled: true,
    quiet_hours: { start_hour: "22:00", end_hour: "06:00" },
    dark_mode_enabled: false
  },
  {
    user_id: NumberInt(213),
    daily_liters_target: NumberInt(250),
    notifications_enabled: true,
    quiet_hours: { start_hour: "23:00", end_hour: "07:00" },
    dark_mode_enabled: true
  }
]);

print("✓ 2 documentos inseridos em user_preferences");

// ─────────────────────────────────────────────────────────────────────────
// Seed: alerts_history
// ─────────────────────────────────────────────────────────────────────────

db.alerts_history.insertMany([
  {
    device_id: "ESP32-SP-0912",
    user_id: NumberInt(212),
    alert_type: "vazamento_continuo",
    triggered_at: new Date("2026-07-16T03:12:00Z"),
    resolved_at: new Date("2026-07-16T08:30:00Z"),
    severity: "high"
  },
  {
    device_id: "ESP32-SP-0913",
    user_id: NumberInt(213),
    alert_type: "fluxo_atipico",
    triggered_at: new Date("2026-07-17T14:00:00Z"),
    resolved_at: null,
    severity: "medium"
  }
]);

print("✓ 2 documentos inseridos em alerts_history");

// ─────────────────────────────────────────────────────────────────────────
// Seed: chat_sessions
// ─────────────────────────────────────────────────────────────────────────

db.chat_sessions.insertMany([
  {
    user_id: NumberInt(212),
    started_at: new Date("2026-07-17T14:00:00Z"),
    last_activity_at: new Date("2026-07-17T14:05:00Z"),
    is_open: false,
    is_active: false,
    is_deleted: false,
    messages: [
      {
        role: "user",
        content_type: "text",
        content: "Por que meu consumo subiu tanto ontem?",
        sent_at: new Date("2026-07-17T14:00:05Z"),
        api_status_code: NumberInt(200)
      },
      {
        role: "bot",
        content_type: "text",
        content: "Identifiquei um fluxo contínuo de 2.8 LPM de madrugada. Pode ser um vazamento.",
        sent_at: new Date("2026-07-17T14:00:12Z"),
        api_status_code: NumberInt(200)
      }
    ]
  }
]);

print("✓ 1 documento inserido em chat_sessions");

// ─────────────────────────────────────────────────────────────────────────
// Seed: chat_feedback
// ─────────────────────────────────────────────────────────────────────────

// Nota: Para este exemplo, precisaríamos do _id da sessão criada acima
// A forma mais segura é fazer insert e depois recuperar o ID
const lastSession = db.chat_sessions.findOne({ user_id: NumberInt(212) });

if (lastSession) {
  db.chat_feedback.insertOne({
    session_id: lastSession._id,
    is_satisfied: true,
    user_comment: "Resolveu minha dúvida rápido.",
    created_at: new Date("2026-07-17T14:06:00Z")
  });
  
  print("✓ 1 documento inserido em chat_feedback");
} else {
  print("⚠️  Aviso: chat_session não encontrada para seed de feedback");
}

// ─────────────────────────────────────────────────────────────────────────
// Seed: weather_daily (dados de exemplo)
// ─────────────────────────────────────────────────────────────────────────

db.weather_daily.insertMany([
  {
    location: {
      city: "São Paulo",
      state: "SP",
      country: "BR"
    },

    date: new Date("2026-09-27T00:00:00Z"),

    hours: [
      {
        hour: NumberInt(0),
        observed_at: new Date("2026-09-27T00:00:00Z"),

        temperature_c: 18.2,
        feels_like_c: 18.0,
        humidity_percent: NumberInt(82),
        pressure_hpa: NumberInt(1017),

        rain_mm: 0.0,
        cloud_coverage_percent: NumberInt(40),

        wind_speed_m_s: 2.1,
        wind_gust_m_s: 3.4,

        condition: "Clouds"
      },
      {
        hour: NumberInt(1),
        observed_at: new Date("2026-09-27T01:00:00Z"),

        temperature_c: 17.9,
        feels_like_c: 17.6,
        humidity_percent: NumberInt(84),
        pressure_hpa: NumberInt(1017),

        rain_mm: 0.0,
        cloud_coverage_percent: NumberInt(45),

        wind_speed_m_s: 1.9,
        wind_gust_m_s: 3.1,

        condition: "Clouds"
      },
      {
        hour: NumberInt(2),
        observed_at: new Date("2026-09-27T02:00:00Z"),

        temperature_c: 17.5,
        feels_like_c: 17.3,
        humidity_percent: NumberInt(85),
        pressure_hpa: NumberInt(1016),

        rain_mm: 0.4,
        cloud_coverage_percent: NumberInt(70),

        wind_speed_m_s: 1.7,
        wind_gust_m_s: 2.8,

        condition: "Rain"
      }
    ],

    samples: NumberInt(3),

    created_at: new Date("2026-09-27T00:01:00Z"),
    updated_at: new Date("2026-09-27T02:01:00Z")
  }
]);

print("✓ 1 documento inserido em weather_raw");

// ─────────────────────────────────────────────────────────────────────────
// RESUMO
// ─────────────────────────────────────────────────────────────────────────

print("\n" + "=".repeat(70));
print("✅ Dados de seed inseridos com sucesso!");
print("=".repeat(70));
