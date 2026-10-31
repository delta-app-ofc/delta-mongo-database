# Database: db_delta_app

Banco de dados de **aplicação com carga leve** dedicado à experiência do usuário final: preferências, histórico de alertas, chat de suporte e histórico meteorológico diário.

## Características

- **Padrão de carga**: Leitura predominante (usuário consultando app)
- **Retenção**: Permanente em todas as coleções
- **Integrações**: Conecta ao PostgreSQL (relacionamento por IDs)

---

## Coleção: `user_preferences`

### Descrição

Preferências do aplicativo por usuário: meta de consumo, horários de silêncio para alertas, modo escuro, etc.

### Ciclo de Vida

- **Retenção**: Permanente
- **Propósito**: Guardar customizações do usuário; lido a cada processamento de telemetria
- **Frequência de leitura**: Alta (a cada 5 min quando processando novo pacote)

### Estrutura

```json
{
  "_id": ObjectId("60c72b2f9b1d8b2bad723456"),
  "user_id": 212,
  "daily_liters_target": 300,
  "notifications_enabled": true,
  "quiet_hours": {
    "start_hour": "22:00",
    "end_hour": "06:00"
  },
  "dark_mode_enabled": false
}
```

### Índices

| Nome | Tipo | Campos | Justificativa |
|---|---|---|---|
| `idx_user_id_unique` | **ÚNICO** | `user_id` | Uma entrada por usuário |

### Padrões de Query

```javascript
// API: Buscar preferências do usuário
db.user_preferences.findOne({ user_id: 212 });

// Atualizar meta do usuário
db.user_preferences.updateOne(
  { user_id: 212 },
  { $set: { daily_liters_target: 350 } },
  { upsert: true }
);
```

---

## Coleção: `alerts_history`

### Descrição

Registro definitivo de **cada anomalia disparada pela IA** — vazamentos, fluxo anômalo, dispositivo offline. É a fonte de dados que o app renderiza na tela de notificações do usuário.

### Ciclo de Vida

- **Retenção**: Permanente
- **Propósito**: Histórico de alertas do usuário; métricas de incidentes
- **Frequência de escrita**: Esporádica (apenas quando IA detecta anomalia)

### Estrutura

```json
{
  "_id": ObjectId("60c72b2f9b1d8b2bad723456"),
  "device_id": "ESP32-SP-0912",
  "user_id": 212,
  "alert_type": "vazamento_continuo",
  "triggered_at": "2026-07-16T03:12:00Z",
  "resolved_at": "2026-07-16T08:30:00Z",
  "severity": "high"
}
```

### Campos válidos: `alert_type`

- `vazamento_continuo` — Fluxo constante detectado (padrão de vazamento)
- `fluxo_atipico` — Consumo fora da rotina aprendida
- `dispositivo_offline` — Aparelho não respondeu há mais de 30 min
- `leitura_impossivel` — Sensor não consegue fazer leitura confiável

### Índices

| Nome | Tipo | Campos | Justificativa |
|---|---|---|---|
| `idx_user_triggered_at_desc` | Composto | `user_id`, `triggered_at` DESC | **Crítico**: tela de notificações |
| `idx_device_unresolved_alerts` | Parcial | `device_id`, `resolved_at` | Alertas ativos por device |

### Padrões de Query

```javascript
// App: Últimos alertas do usuário (tela de notificações)
db.alerts_history.find({
  user_id: 212
}).sort({ triggered_at: -1 }).limit(20);

// Alertas ainda ativos (não resolvidos)
db.alerts_history.find({
  device_id: "ESP32-SP-0912",
  resolved_at: null
});

// Admin: Incidentes no mês
db.alerts_history.find({
  triggered_at: { 
    $gte: ISODate("2026-07-01T00:00:00Z"),
    $lt: ISODate("2026-08-01T00:00:00Z")
  }
}).sort({ triggered_at: -1 });
```

---

## Coleção: `chat_sessions`

### Descrição

Sessões de chat entre usuário e bot de suporte. Usa o padrão **Bucket** (uma sessão = um documento com array de mensagens embutido).

### Ciclo de Vida

- **Retenção**: Permanente
- **Propósito**: Histórico conversacional; treino futuro de modelo de IA
- **Frequência de escrita**: Moderada (usuário abre chat ocasionalmente)

### Limite de Tamanho

Cada documento pode ter no máximo **50–100 mensagens**. Ao atingir o limite, o back-end:
1. Fecha a sessão (`is_open: false`)
2. Cria uma nova sessão (ex: "Parte 2")

### Campos de resumo da conversa

Usados pela lista de histórico do app (título, prévia e ícone de cada conversa). São opcionais: a
API de IA (`delta-artificial-intelligence`) os gera com um modelo de linguagem na primeira troca de
mensagens da sessão. Sessões sem esses campos continuam válidas; nesse caso o cliente usa o início da
primeira mensagem como título.

| Campo | Tipo | Limite | Descrição |
|---|---|---|---|
| `title` | string | 100 caracteres | Título curto da conversa (a IA gera até 40) |
| `preview` | string | 200 caracteres | Frase-resumo exibida abaixo do título (a IA gera até 80) |
| `icon` | string | 40 caracteres | Nome do ícone do assunto, que o app converte em imagem |

Valores de `icon` hoje produzidos pela IA: `routine`, `habits`, `summary`, `report`, `savings`,
`leak`, `forecast`, `consumption`, `tips` e `general`. O validador não restringe a lista, porque ela
pode crescer junto com os ícones do app; um valor desconhecido deve ser exibido como `general`.

### Estrutura

```json
{
  "_id": ObjectId("60c72b2f9b1d8b2bad723456"),
  "user_id": 212,
  "started_at": "2026-07-17T14:00:00Z",
  "last_activity_at": "2026-07-17T14:05:00Z",
  "is_open": false,
  "is_active": false,
  "is_deleted": false,
  "title": "Consumo acima do normal",
  "preview": "Fluxo contínuo de madrugada, possível vazamento",
  "icon": "leak",
  "messages": [
    {
      "role": "user",
      "content_type": "text",
      "content": "Por que meu consumo subiu tanto ontem?",
      "sent_at": "2026-07-17T14:00:05Z",
      "api_status_code": 200
    },
    {
      "role": "bot",
      "content_type": "text",
      "content": "Identifiquei um fluxo contínuo de 2.8 LPM de madrugada. Pode ser um vazamento.",
      "sent_at": "2026-07-17T14:00:12Z",
      "api_status_code": 200
    }
  ]
}
```

### Índices

| Nome | Tipo | Campos | Justificativa |
|---|---|---|---|
| `idx_user_activity_desc` | Composto | `user_id`, `last_activity_at` DESC | Lista de atendimentos anteriores |
| `idx_user_open_sessions` | Composto | `user_id`, `is_open` | Encontrar sessão aberta |

### Padrões de Query

```javascript
// App: Histórico de chats do usuário
db.chat_sessions.find({
  user_id: 212
}).sort({ last_activity_at: -1 }).limit(20);

// App: Abrir chat anterior para continuar
db.chat_sessions.findOne({
  _id: ObjectId("..."),
  user_id: 212
});

// Back-end: Encontrar uma sessão aberta para o usuário
db.chat_sessions.findOne({
  user_id: 212,
  is_open: true
});

// Back-end: Adicionar nova mensagem
db.chat_sessions.updateOne(
  { _id: ObjectId("...") },
  {
    $push: { messages: { role: "bot", text: "...", sent_at: new Date(), api_status_code: 200 } },
    $set: { last_activity_at: new Date() }
  }
);
```

### Reabertura de Sessão

Se o usuário abrir um chat anterior e enviar uma mensagem nova:

```javascript
// Back-end: Reabrir se estava fechada
db.chat_sessions.updateOne(
  { _id: ObjectId("...") },
  {
    $set: { is_open: true, is_active: true },
    $push: { messages: { role: "user", content_type: "text", content: "...", sent_at: new Date(), api_status_code: 200 } }
  }
);

// Opcionalmente, recria chat_context (ver db_delta_app.md seção Chat Context — Planejada)
```

---

## Coleção: `chat_feedback`

### Descrição

Avaliação do usuário sobre cada sessão de chat encerrada (satisfação com o bot, comentário livre).

### Ciclo de Vida

- **Retenção**: Permanente
- **Propósito**: Métricas de satisfação; input para melhoria contínua do bot
- **Frequência de escrita**: Baixa (usuário avalia ao fim de sessão)

### Estrutura

```json
{
  "_id": ObjectId("60c72b2f9b1d8b2bad723c001"),
  "session_id": ObjectId("61a8f9c2b9d1b2bad723c001"),
  "is_satisfied": true,
  "user_comment": "Resolveu minha dúvida rápido.",
  "created_at": "2026-07-17T14:06:00Z"
}
```

### Índices

| Nome | Tipo | Campos | Justificativa |
|---|---|---|---|
| `idx_session_id` | Simples | `session_id` | Cruzar com chat_sessions |

### Padrões de Query

```javascript
// App: Buscar feedback de uma sessão
db.chat_feedback.findOne({
  session_id: ObjectId("61a8f9c2b9d1b2bad723c001")
});

// Analytics: Satisfação do mês
db.chat_feedback.aggregate([
  {
    $match: {
      created_at: {
        $gte: ISODate("2026-07-01T00:00:00Z"),
        $lt: ISODate("2026-08-01T00:00:00Z")
      }
    }
  },
  {
    $group: {
      _id: null,
      total_sessions: { $sum: 1 },
      satisfied: { $sum: { $cond: ["$is_satisfied", 1, 0] } },
      satisfaction_rate: { 
        $avg: { $cond: ["$is_satisfied", 1, 0] }
      }
    }
  }
]);
```

---

## Coleção: `weather_daily`

Histórico meteorológico permanente em `db_delta_app`: um documento agrupa até 24 observações horárias por localização e dia. Não há TTL.

### Campos do schema atual

| Campo | Tipo BSON | Obrigatório | Regra |
| --- | --- | --- | --- |
| `_id` | objectId | Gerado pelo MongoDB | Identificador |
| `location` | object | Sim | Exige `city`, `state` e `country`, todos string |
| `weather_date` | date | Não | Data de referência normalizada para o início do dia |
| `hours` | array de objetos | Sim | No máximo 24 itens; pode estar vazio |
| `samples` | int | Sim | Entre 0 e 24 |
| `created_at` | date | Sim | Criação do documento |
| `updated_at` | date | Não | Última atualização |

Todos os campos abaixo são obrigatórios em cada item de `hours`:

| Campo | Tipo BSON | Regra |
| --- | --- | --- |
| `hour` | int | De 0 a 23 |
| `observed_at` | date | Momento da observação |
| `temperature_c` | double, int, long ou decimal | Temperatura em °C |
| `feels_like_c` | double, int, long ou decimal | Sensação térmica em °C |
| `humidity_percent` | int, long, double ou decimal | De 0 a 100 |
| `rain_mm` | double, int, long ou decimal | Maior ou igual a zero |
| `wind_speed_mps` | double, int, long ou decimal | Vento em m/s, maior ou igual a zero |
| `condition` | string | Sem enum definido no validator |

`date`, `wind_speed_m_s`, `wind_gust_m_s`, pressão, direção do vento e códigos meteorológicos não fazem parte dos campos definidos no schema atual. O validator não declara `additionalProperties: false`, portanto campos extras não são automaticamente rejeitados.

O produtor deve manter `samples == hours.length`, evitar horas repetidas e alinhar `observed_at` ao dia de referência. Essas relações não são verificadas pelo `$jsonSchema` atual. O schema também não exige `weather_date` nem um mínimo de observações.

### Exemplo para mongosh

```javascript
db.weather_daily.insertOne({
  location: { city: "São Paulo", state: "SP", country: "BR" },
  weather_date: ISODate("2026-09-27T00:00:00Z"),
  hours: [{
    hour: NumberInt(0),
    observed_at: ISODate("2026-09-27T00:00:00Z"),
    temperature_c: 18.2,
    feels_like_c: 18.0,
    humidity_percent: NumberInt(82),
    rain_mm: 0.0,
    wind_speed_mps: 2.1,
    condition: "Clouds"
  }],
  samples: NumberInt(1),
  created_at: ISODate("2026-09-27T00:01:00Z")
});

db.weather_daily.find({
  "location.country": "BR",
  "location.state": "SP",
  "location.city": "São Paulo",
  weather_date: {
    $gte: ISODate("2026-09-01T00:00:00Z"),
    $lt: ISODate("2026-10-01T00:00:00Z")
  }
}).sort({ weather_date: -1 });
```

### Índice: divergência pendente

O script de índices ainda cria `idx_location_date_unique`, único, sobre `{ "location.country": 1, "location.state": 1, "location.city": 1, date: -1 }`. O schema e o seed usam `weather_date`. Portanto, o índice atual não garante unicidade por `weather_date`: documentos sem `date` para a mesma localização podem colidir no índice mesmo em dias diferentes.

A intenção é garantir um documento por localização e dia, mas isso depende de alinhar o índice a `weather_date`. Esta atualização é documental e não modifica o script nem os índices de um banco existente.

---

## Estruturas Planejadas (Ainda não Implementadas)

### `chat_context` (Futuro)

Quando o chatbot evoluir de regras fixas para um modelo conversacional (LLM), será necessário guardar o contexto temporário (tópico atual, entidades extraídas) para reduzir o custo de tokens.

**Características esperadas:**
- TTL Index: 30 minutos
- Campos: `session_id`, `current_topic`, `extracted_entities`, etc.
- Uso: Alimentar API de IA com resumo mastigado, não com 100 mensagens

**Status**: Design pronto, implementação aguardando evolução do bot para LLM.

---

## Integrações com PostgreSQL

Os IDs no MongoDB (`user_id`, `device_id`) são **referências lógicas** para registros no PostgreSQL:

- `user_id` → `tb_user.id` no PostgreSQL
- `device_id` → `tb_device.device_id` no PostgreSQL

O MongoDB **não impõe Foreign Keys** (típico de NoSQL), então a validação desses IDs é responsabilidade do código do back-end antes de inserir.
