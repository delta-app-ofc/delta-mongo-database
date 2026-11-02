# Delta NoSQL Database

Scripts de criação e configuração das coleções MongoDB do Projeto Delta.

## Estrutura

- `scripts/delta-telemetry/` — coleções, índices, roles e seed de `db_delta_telemetry`.
- `scripts/delta-app/` — coleções, índices, roles e seed de `db_delta_app`.
- `collections/` — documentação dos schemas e consultas.
- `QUICK_START.md` — configuração e exemplos de uso.

## Modelo atual

- **Telemetria:** `consumption_summary` recebe diretamente o consumo consolidado pelo hardware, com retenção permanente; `device_status` mantém um documento por dispositivo.
- **Aplicativo:** `user_preferences`, `alerts_history`, `user_hour_baseline`, `chat_sessions`, `chat_feedback`, `weather_daily` e `observability_requests`.
- **Clima:** `weather_daily` agrupa até 24 observações horárias por localização e dia, com `weather_date` e `wind_speed_mps`.

Consulte [telemetria](collections/db_delta_telemetry.md), [aplicativo e clima](collections/db_delta_app.md) e [Quick Start](QUICK_START.md).

O script atual do índice único de `weather_daily` usa `weather_date`, conforme o schema.
Consulte [DOCKER-HELP.md](DOCKER-HELP.md) para usar o ambiente Docker local.

## Teste de integração

O Compose de testes inicializa MongoDB 7 em armazenamento temporário, sem porta publicada e sem conexão com o Atlas. Ele aplica os scripts de coleções e índices e executa as verificações comportamentais em `tests/smoke.js`.

```bash
docker compose -p delta-mongo-audit-test -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from runner
docker compose -p delta-mongo-audit-test -f docker-compose.test.yml down
```

O runner grava um relatório JUnit agregado em `reports/junit.xml`; ele registra o resultado da execução de integração, sem fingir contar cada asserção como um teste separado. A execução em `mongosh` não produz relatório LCOV, então esta suite não declara um percentual de cobertura. O scanner Sonar analisa os scripts JavaScript; mudanças futuras nesses scripts precisam fornecer evidência de cobertura compatível com a política central.
