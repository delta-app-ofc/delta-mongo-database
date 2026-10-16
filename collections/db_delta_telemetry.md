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
  "anomaly_detected": false
}
```

### Contrato de ingestão

O validator exige `device_id` (string), `user_id` (int), `window_started_at` e `window_finished_at` (date), e `consumption_liters` (double). `lpm_average` (double) e `anomaly_detected` (bool) são opcionais. O hardware calcula o consumo; a API valida a identidade do dispositivo, associa o usuário e persiste a janela. A detecção de anomalias ocorre sobre os resumos e não é pré-requisito para a ingestão.

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
  "battery_level": 80,
  "availability_started_at": ISODate("2026-07-16T17:10:00Z"),
  "availability_updated_at": ISODate("2026-07-17T17:10:00Z"),
  "available_seconds": NumberLong(85800),
  "unavailabilities": [
    {
      "started_at": ISODate("2026-07-17T10:00:00Z"),
      "ended_at": ISODate("2026-07-17T10:10:00Z"),
      "unavailable_seconds": NumberLong(600),
      "unavailability_reason": "Perda de conexão Wi-Fi"
    }
  ]
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

## Disponibilidade e indisponibilidades

O grupo `availability_started_at`, `availability_updated_at`, `available_seconds`
e `unavailabilities` é opcional para compatibilidade. Informar
qualquer um exige o grupo completo. Tempos em segundos aceitam BSON int/long não negativo;
as datas são BSON date. A seed contém exemplos simulados, inclusive um intervalo aberto.
O contador real deverá ser mantido pelo backend; ele não é calculado pelos scripts MongoDB.

- `availability_started_at`: início da observação. Não preencher com a instalação se não
  existir histórico completo desde aquele instante.
- `availability_updated_at`: corte até o qual todos os tempos foram atualizados. Não confundir
  com `last_ping_at`, que pode estar antigo durante uma indisponibilidade.
- `available_seconds`: tempo comprovadamente online entre início e corte.
- `unavailabilities`: intervalos fechados ou uma única ocorrência ainda aberta (`ended_at: null`).
  Cada duração é calculada até seu fim ou, se aberta, até `availability_updated_at`.
- `unavailability_reason`: motivo histórico dentro de cada intervalo; permanece após a reconexão.
  O campo externo foi removido do contrato. A seed contém apenas exemplos simulados; não há
  marcador de mock no schema atual.

Para o período inteiro coberto, a disponibilidade é
`100 × available_seconds / (available_seconds + soma(unavailable_seconds))`.
No exemplo, `100 × 85800 / 86400 = 99,31%`. Denominador zero ou histórico ausente produz
resultado desconhecido, não 0% ou 100%. A média entre dispositivos usa seus percentuais
individuais; não confundir com a taxa ponderada pelo tempo de observação.

Para filtrar dia/mês, a Gold deverá recortar os intervalos pela interseção com o período,
limitado a `[availability_started_at, availability_updated_at)`. Somente com histórico completo
o tempo disponível do recorte pode ser obtido pelo tempo observado menos as indisponibilidades.
O backend precisa definir o prazo de ausência de ping que abre uma indisponibilidade e tratar
`unstable` explicitamente. Falta de observação não prova tempo online nem offline.
Se houver lacunas sem classificação, não publicar disponibilidade para aquele recorte.

Regras do backend: início anterior ou igual ao fim/corte; intervalos dentro da observação,
ordenados e sem sobreposição; no máximo um intervalo aberto; total disponível + indisponível
igual à duração observada para um histórico completo. Atualizar estado, contador, corte e
array juntos, de forma idempotente, sem somar novamente o mesmo intervalo em pings repetidos.
Fechar o intervalo aberto ao reconectar. Não zerar o contador sem iniciar um novo período
explicitamente e preservar o histórico anterior para BI. Essas relações temporais não são
impostas pelo `$jsonSchema`, que valida tipos, não a soma entre campos.

O array embutido atende ao contrato inicial. Deve haver acompanhamento do crescimento do
documento e arquivamento dos intervalos antes de exceder o limite de documento do MongoDB;
remover eventos antigos sem preservá-los invalidaria os filtros históricos.

Para coleções existentes, execute manualmente no mongosh do Compass
[`scripts/script-bi-metrics-update.js`](../scripts/script-bi-metrics-update.js).
Ele atualiza somente os validadores de chat e status; não altera documentos nem inicializa
contadores antigos com zero. As duas alterações não formam uma transação; após falha, corrija
a causa e reexecute. Bronze/Silver/Gold ainda precisam propagar e consumir os novos campos.

## Integração histórica planejada

Uma exportação para Databricks / AWS S3 pode ler as janelas de `consumption_summary` e gerar arquivos Parquet, tabelas Delta Lake e agregações para o PostgreSQL. O fluxo não depende de pulsos brutos nem de expiração em sete dias.

Os scripts deste repositório não implementam esse pipeline. `consumption_summary` permanece sem TTL; exportar dados não remove o histórico operacional automaticamente.
