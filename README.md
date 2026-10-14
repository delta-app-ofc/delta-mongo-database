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

## Coordenadas do clima

`weather_daily.location` aceita o par opcional numérico `latitude`/`longitude`. Para atualizar uma coleção já existente pelo Compass, use somente [script-weather-location-update.js](scripts/delta-app/script-weather-location-update.js). O arquivo não insere dados nem recria coleções. O schema, a seed e os índices de setup inicial também foram atualizados; o grão único por cidade/data é preservado. Leia o [contrato detalhado](collections/db_delta_app.md#coordenadas-e-índices).

Verificação estrutural local: `node tests/weather-location-contract.cjs`. Não substitui a aplicação/validação no MongoDB real. Bronze/Silver/Gold e dataload serão tratados em outra etapa.
