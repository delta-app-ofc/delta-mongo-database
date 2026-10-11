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

**Pendência conhecida:** o índice único de `weather_daily` ainda aponta para `date`, enquanto o schema e o seed usam `weather_date`. A documentação registra essa divergência; os scripts não foram alterados nesta atualização.
