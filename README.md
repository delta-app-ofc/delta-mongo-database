# Delta NoSQL Database

Scripts de criação e configuração das coleções MongoDB do Projeto Delta.

## Estrutura

- `scripts/delta-telemetry/` — coleções, índices, roles e seed de `db_delta_telemetry`.
- `scripts/delta-app/` — coleções, índices, roles e seed de `db_delta_app`.
- `collections/` — documentação dos schemas e consultas.
- `QUICK_START.md` — configuração e exemplos de uso.

## Modelo atual

- **Telemetria:** `consumption_summary` recebe diretamente o consumo consolidado pelo hardware, com retenção permanente; `device_status` mantém um documento por dispositivo.
- **Aplicativo:** `user_preferences`, `alerts_history`, `chat_sessions`, `chat_feedback` e `weather_daily`.
- **Clima:** `weather_daily` agrupa até 24 observações horárias por localização e dia, com `weather_date` e `wind_speed_mps`.

Consulte [telemetria](collections/db_delta_telemetry.md), [aplicativo e clima](collections/db_delta_app.md) e [Quick Start](QUICK_START.md).

## Métricas de resposta e disponibilidade

As mensagens de `chat_sessions` aceitam o especialista em `agent_name`, sua duração em
`response_time_ms`. `api_status_code` continua sendo
a fonte de falhas técnicas; ele não representa avaliação do juiz.

`device_status` aceita `available_seconds`, o início/corte da observação e um array
`unavailabilities` com início, fim, segundos indisponíveis e motivo. A seed traz exemplos
simulados apenas para desenvolvimento. Os campos são opcionais para documentos antigos, sem zerar dados
desconhecidos. Backend e pipelines analíticos ainda não foram alterados.

Em coleções existentes, use manualmente [script-bi-metrics-update.js](scripts/script-bi-metrics-update.js)
no mongosh do Compass. Ele atualiza os dois validadores e não insere nem modifica documentos.
O setup inicial continua usando os scripts de coleções por banco. Não é necessário novo índice
para os cálculos desta alteração: chat e status já são extraídos para a camada analítica.

Verificação estrutural sem banco: `node tests/bi-metrics-contract.cjs`. Confere a coerência
dos mocks e a atualização dos validadores com preservação de regras existentes. O runner
Docker também inclui casos de aceitação de documentos antigos e novos, rejeição de tempos
negativos e grupos incompletos; esses casos exigem MongoDB real em execução.

O script atual do índice único de `weather_daily` usa `weather_date`, conforme o schema.
Consulte [DOCKER-HELP.md](DOCKER-HELP.md) para usar o ambiente Docker local.
