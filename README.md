# Delta Â· Banco de dados MongoDB

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.19-339933?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7%20%28teste%20local%29-47A248?logo=mongodb&logoColor=white)
![MongoDB Driver](https://img.shields.io/badge/Driver-6.21.0-47A248?logo=mongodb&logoColor=white)

Este repositÃ³rio define os bancos, coleÃ§Ãµes e contratos MongoDB usados pelo Delta. ReÃºne validaÃ§Ã£o de documentos, Ã­ndices, roles de acesso, dados de desenvolvimento e migrations versionadas para telemetria e dados da aplicaÃ§Ã£o.

**Tags:** `delta` Â· `mongodb` Â· `nosql` Â· `schema-validation` Â· `indexes` Â· `migrations` Â· `telemetria-iot`

## SumÃ¡rio

- [VisÃ£o geral](#visÃ£o-geral)
- [Bancos e coleÃ§Ãµes](#bancos-e-coleÃ§Ãµes)
- [Estrutura do repositÃ³rio](#estrutura-do-repositÃ³rio)
- [InstalaÃ§Ã£o e validaÃ§Ã£o local](#instalaÃ§Ã£o-e-validaÃ§Ã£o-local)
- [Scripts de bootstrap](#scripts-de-bootstrap)
- [Migrations incrementais](#migrations-incrementais)
- [CI e documentaÃ§Ã£o](#ci-e-documentaÃ§Ã£o)
- [RepositÃ³rios relacionados](#repositÃ³rios-relacionados)

## VisÃ£o geral

| Banco | Finalidade | ColeÃ§Ãµes versionadas nos scripts de bootstrap |
|---|---|---|
| `db_delta_telemetry` | Resumos de consumo enviados pelo hardware e estado corrente dos dispositivos. | `consumption_summary`, `device_status` |
| `db_delta_app` | PreferÃªncias, alertas, conversas e dados de clima consumidos pela aplicaÃ§Ã£o. | `user_preferences`, `alerts_history`, `chat_sessions`, `chat_feedback`, `weather_daily` |

Os scripts de coleÃ§Ãµes aplicam validaÃ§Ã£o por JSON Schema; os scripts de Ã­ndices definem as chaves de busca, unicidade e retenÃ§Ã£o presentes no contrato atual. Os campos `user_id` e `device_id` identificam usuÃ¡rios e dispositivos cadastrados nos demais bancos do Delta.

`consumption_summary` armazena o consumo consolidado enviado pelo hardware. `device_status` mantÃ©m o estado corrente por dispositivo. `chat_sessions` reÃºne mensagens no mesmo documento; `weather_daily` agrupa observaÃ§Ãµes por localizaÃ§Ã£o e dia, usando `weather_date` e `wind_speed_mps`.

## Bancos e coleÃ§Ãµes

| ColeÃ§Ã£o | Banco | Papel |
|---|---|---|
| `consumption_summary` | `db_delta_telemetry` | Janela de consumo consolidada por dispositivo e usuÃ¡rio. |
| `device_status` | `db_delta_telemetry` | Estado mais recente comunicado pelo dispositivo. |
| `user_preferences` | `db_delta_app` | PreferÃªncias do usuÃ¡rio na aplicaÃ§Ã£o. |
| `alerts_history` | `db_delta_app` | HistÃ³rico de alertas e seus estados. |
| `chat_sessions` | `db_delta_app` | SessÃµes e mensagens embutidas no padrÃ£o bucket. |
| `chat_feedback` | `db_delta_app` | AvaliaÃ§Ã£o associada logicamente a uma sessÃ£o. |
| `weather_daily` | `db_delta_app` | Dados meteorolÃ³gicos diÃ¡rios e observaÃ§Ãµes horÃ¡rias. |

Detalhes de campos, validaÃ§Ã£o, Ã­ndices e exemplos de consulta estÃ£o em [telemetria](collections/db_delta_telemetry.md) e [dados do app](collections/db_delta_app.md).

## Estrutura do repositÃ³rio

~~~text
delta-mongo-database/
â”œâ”€â”€ .github/
â”‚   â””â”€â”€ workflows/
â”‚       â”œâ”€â”€ test.yml
â”‚       â””â”€â”€ migrations.yml
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ migrate.js
â”‚   â”œâ”€â”€ delta-telemetry/
â”‚   â”‚   â”œâ”€â”€ script-collections.js
â”‚   â”‚   â”œâ”€â”€ script-indexes.js
â”‚   â”‚   â”œâ”€â”€ script-roles.js
â”‚   â”‚   â””â”€â”€ script-seed.js
â”‚   â””â”€â”€ delta-app/
â”‚       â”œâ”€â”€ script-collections.js
â”‚       â”œâ”€â”€ script-indexes.js
â”‚       â”œâ”€â”€ script-roles.js
â”‚       â””â”€â”€ script-seed.js
â”œâ”€â”€ migrations/
â”‚   â””â”€â”€ contract-baseline-0001.json
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ smoke.js
â”‚   â””â”€â”€ migration-runner.test.js
â”œâ”€â”€ collections/
â”‚   â”œâ”€â”€ db_delta_telemetry.md
â”‚   â””â”€â”€ db_delta_app.md
â”œâ”€â”€ docker-compose.test.yml
â”œâ”€â”€ package.json
â”œâ”€â”€ QUICK_START.md
â”œâ”€â”€ migrations.md
â””â”€â”€ DOCKER-HELP.md
~~~

## InstalaÃ§Ã£o e validaÃ§Ã£o local

Requisitos: Node.js `20.19` ou superior, npm e Docker Engine com Docker Compose v2. O Compose de testes executa MongoDB 7 em containers temporÃ¡rios, sem publicar portas no host ou armazenar dados em volume.

Instale as dependÃªncias travadas e rode a suÃ­te Node:

~~~bash
npm ci
npm test
~~~

Para conferir a configuraÃ§Ã£o e executar os smoke checks contra uma instÃ¢ncia temporÃ¡ria:

~~~bash
docker compose -p delta-mongo-database-test -f docker-compose.test.yml config --quiet
docker compose -p delta-mongo-database-test -f docker-compose.test.yml run --rm runner
docker compose -p delta-mongo-database-test -f docker-compose.test.yml down
~~~

O runner aplica coleÃ§Ãµes e Ã­ndices de ambos os bancos e executa `tests/smoke.js`. O serviÃ§o `migration-test` tambÃ©m pode ser executado com o perfil `migrations`; o workflow de CI usa esse serviÃ§o para validar o baseline e o runner de migrations:

~~~bash
docker compose -p delta-mongo-database-test -f docker-compose.test.yml --profile migrations run --rm migration-test
docker compose -p delta-mongo-database-test -f docker-compose.test.yml down
~~~

Esses comandos usam apenas dados descartÃ¡veis locais. Consulte [DOCKER-HELP.md](DOCKER-HELP.md) para diagnÃ³stico e limpeza segura.

## Scripts de bootstrap

Cada banco tem seu prÃ³prio conjunto de scripts. Para uma instalaÃ§Ã£o inicial, a ordem de preparo Ã©:

1. `script-collections.js`: cria coleÃ§Ãµes e validadores.
2. `script-indexes.js`: instala Ã­ndices de consulta, unicidade e retenÃ§Ã£o definidos no contrato.
3. `script-roles.js`: provisiona Custom Roles para o Atlas, de acordo com a polÃ­tica do banco.
4. `script-seed.js`: carrega dados de desenvolvimento.

O smoke runner executa os scripts de coleÃ§Ãµes e Ã­ndices. Para conexÃ£o, comandos `mongosh` e configuraÃ§Ã£o manual no Atlas, siga [QUICK_START.md](QUICK_START.md).

## Migrations incrementais

A pasta `migrations/` contÃ©m o snapshot inicial `0001`. O runner registra versÃµes, checksums, execuÃ§Ãµes parciais e lock no banco de controle `delta_migration_control`.

Para consultar um destino previamente selecionado, configure `MONGO_MIGRATION_URI` sem imprimir nem versionar o valor e use:

~~~bash
npm run migrate -- status
npm run migrate -- check-baseline
~~~

O comando `up` aplica as migrations pendentes ao banco indicado pela URI. As regras de baseline, recuperaÃ§Ã£o e workflow manual estÃ£o em [migrations.md](migrations.md). O workflow de migrations Ã© executado manualmente na branch `main`, com secrets do ambiente.

## CI e documentaÃ§Ã£o

O workflow `test.yml` executa smoke checks de schema e Ã­ndices, alÃ©m dos testes do runner, em MongoDB descartÃ¡vel durante Pull Requests. O workflow `migrations.yml` oferece aÃ§Ãµes manuais para consulta, baseline e aplicaÃ§Ã£o de migrations.

- [Quick Start](QUICK_START.md): preparaÃ§Ã£o inicial e exemplos de acesso.
- [Migrations](migrations.md): baseline, execuÃ§Ã£o, checksums e recuperaÃ§Ã£o.
- [Docker Help](DOCKER-HELP.md): comandos do ambiente local.
- [ColeÃ§Ãµes de telemetria](collections/db_delta_telemetry.md) e [coleÃ§Ãµes do app](collections/db_delta_app.md): contratos detalhados.

## RepositÃ³rios relacionados

- [delta-api-mongo](https://github.com/delta-app-ofc/delta-api-mongo): API de ingestÃ£o e consulta da telemetria.
- [delta-business-rules](https://github.com/delta-app-ofc/delta-business-rules): regras determinÃ­sticas sobre consumo e alertas.
- [delta-handbook](https://github.com/delta-app-ofc/delta-handbook): visÃ£o geral da arquitetura e regras de dados.
