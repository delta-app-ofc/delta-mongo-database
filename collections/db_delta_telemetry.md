# Database: db_delta_telemetry

Banco de dados **operacional de alta carga** dedicado à ingestão de telemetria do ESP32/Arduino e processamento de dados de série temporal.

## Características

- **Padrão de carga**: Escrita pesada e constante (dispositivos enviam a cada 5–10 minutos)
- **Integrações**: Alimenta a IA em tempo real e o Databricks para análise histórica
- **Usuários**: API Back-end (`role_api_service`), Databricks (`role_data_pipeline_reader`)

---

## Coleção: `consumption_summary`

### Descrição

Documento **consolidado e leve**, gerado logo pelo hardware. Contém o resumo de consumo para cada janela de 5 minutos e **é a fonte oficial** que o app consulta para gráficos e histórico.

### Ciclo de Vida

- **Retenção**: **Permanente** (sem TTL)
- **Propósito**: Histórico operacional; fonte dos gráficos do app; input para agregações diárias no PostgreSQL
- **Frequência de escrita**: Uma vez a cada 5 minutos por dispositivo

### Estrutura

```json
{
  "_id": ObjectId("60c72b2f9b1d8b2bad723456"),
  "device_id": "ESP32-SP-0912",
  "user_id": 212,
  "window_started_at": "2026-07-17T17:05:00Z",
  "window_finished_at": "2026-07-17T17:10:00Z",
  "consumption_liters": 14,
  "lpm_average": 2,
  "anomaly_detected": false
}
```

### Índices

| Nome | Tipo | Campos | Justificativa |
|---|---|---|---|
| `idx_user_window_time` | Composto | `user_id`, `window_started_at` DESC | **CRÍTICO**: alimenta gráfico do app |
| `idx_device` | Simples | `device_id` | Consultas admin/suporte |

### Padrões de Query Esperados

```javascript
// App: Histórico de consumo do usuário (últimos 30 dias)
db.consumption_summary.find({
  user_id: 212,
  window_started_at: { $gte: new Date(Date.now() - 2592000000) }
}).sort({ window_started_at: -1 }).limit(1000);

// Agregação: Consumo diário para dashboard SQL
db.consumption_summary.aggregate([
  { $match: { user_id: 212 } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$window_started_at" } },
      total_liters: { $sum: "$consumption_liters" },
      max_lpm: { $max: "$lpm_average" }
  }},
  { $sort: { _id: -1 } }
]);
```

---

## Coleção: `device_status`

### Descrição

Um **único documento por dispositivo**, atualizado via *upsert* a cada ping. Representa o estado atual do hardware (online/offline, versão firmware, sinal Wi-Fi).

### Ciclo de Vida

- **Retenção**: Permanente
- **Propósito**: Painel administrativo de saúde dos dispositivos
- **Frequência de atualização**: A cada nova telemetria (5–10 min)

### Estrutura

```json
{
  "_id": ObjectId("60c72b2f9b1d8b2bad723456"),
  "device_id": "ESP32-SP-0912",
  "last_ping_at": "2026-07-17T17:10:00Z",
  "wifi_signal_rssi": "good",
  "firmware_version": "v1.2.3",
  "connectivity_status": "online",
  "unavailability_reason": null
}
```

### Índices

| Nome | Tipo | Campos | Justificativa |
|---|---|---|---|
| `idx_device_id_unique` | **ÚNICO** | `device_id` | Garante uma entrada por dispositivo |

### Padrões de Escrita

```javascript
// API: Atualizar status do dispositivo (upsert)
db.device_status.updateOne(
  { device_id: "ESP32-SP-0912" },
  {
    $set: {
      last_ping_at: new Date(),
      connectivity_status: "online",
      wifi_signal_rssi: "good",
      firmware_version: "v1.2.3"
    }
  },
  { upsert: true }
);
```

---

## Integração com Datab ricks / AWS S3

Ao fim de cada dia (ex: 02:00 AM), o Databricks:

1. Lê `consumption_summary` da última 24h
2. Lê `pulses_raw` antes de expirar (7 dias)
3. Exporta para AWS S3 em formato Parquet
4. Cria tabelas Delta Lake (Bronze → Prata → Ouro)
5. Envia agregações diárias para o PostgreSQL (`tb_last_water_bill`, `consumption_summary_daily`)

Essa divisão garante:
- ✅ MongoDB ágil e leve (sem carregar bilhões de registros)
- ✅ S3/Delta Lake como repositório eterno de auditoria (barato)
- ✅ PostgreSQL com dados mastigados para BI (rápido)
