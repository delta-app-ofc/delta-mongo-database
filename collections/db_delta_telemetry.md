# Database: db_delta_telemetry

Banco de dados **operacional de alta carga** dedicado à ingestão de telemetria do ESP32/Arduino e processamento de dados de série temporal.

## Características

- **Padrão de carga**: Escrita pesada e constante (dispositivos enviam a cada 5–10 minutos)
- **Integrações**: Alimenta a IA em tempo real e o Databricks para análise histórica
- **Usuários**: API Back-end (`role_api_service`), Databricks (`role_data_pipeline_reader`)

---

## Coleção: `consumption_summary`

### Descrição

Documento **consolidado e leve**, calculado pelo hardware e enviado diretamente para persistência em `consumption_summary`, sem etapa de armazenamento de pulsos brutos. Contém o resumo de consumo para cada janela de 5 minutos e **é a fonte oficial** que o app consulta para gráficos e histórico.

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
  "anomaly_detected": false,
  "anomaly_reasons": [],
  "detector_version": "dev-1"
}
```

### Campos do detector de anomalias

Preenchidos pelo detector do `delta-api-mongo` logo após a gravação da janela. Todos são opcionais.

| Campo | Tipo | Descrição |
|---|---|---|
| `anomaly_detected` | bool ou null | `true`/`false` é o resultado; `null` significa que a janela não foi avaliada ou que o detector falhou. `null` nunca deve ser lido como "sem vazamento" |
| `anomaly_reasons` | array de string | Regras que sinalizaram a janela (ex.: `continuous_flow`, `night_floor`, `robust_zscore`) |
| `anomaly_evidence` | objeto | Leituras, horários e baseline usados na decisão |
| `detection_error` | string | Motivo da falha; vem junto com `anomaly_detected: null` |
| `detector_version` | string | Versão do detector e da configuração que avaliou a janela |

### Contrato de ingestão

O validator exige `device_id` (string), `user_id` (int), `window_started_at` e `window_finished_at` (date), e `consumption_liters` (double). `lpm_average` (double) e `anomaly_detected` (bool ou null) são opcionais. O hardware calcula o consumo; a API valida a identidade do dispositivo, associa o usuário e persiste a janela. A detecção de anomalias ocorre sobre os resumos e não é pré-requisito para a ingestão.

As datas dos exemplos representam valores BSON date, não strings armazenadas. Para inserts em mongosh, use `ISODate`, `NumberInt` e `NumberDouble` conforme o tipo exigido. A duração de cinco minutos e a ordem entre início e fim são regras do produtor; o validator atual apenas verifica tipos e campos obrigatórios.

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

## Integração histórica planejada

Uma exportação para Databricks / AWS S3 pode ler as janelas de `consumption_summary` e gerar arquivos Parquet, tabelas Delta Lake e agregações para o PostgreSQL. O fluxo não depende de pulsos brutos nem de expiração em sete dias.

Os scripts deste repositório não implementam esse pipeline. `consumption_summary` permanece sem TTL; exportar dados não remove o histórico operacional automaticamente.
