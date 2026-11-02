# Delta · Banco de dados MongoDB

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.19-339933?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7%20%28teste%20local%29-47A248?logo=mongodb&logoColor=white)
![MongoDB Driver](https://img.shields.io/badge/Driver-6.21.0-47A248?logo=mongodb&logoColor=white)

Aqui ficam os contratos e scripts que organizam a memória documental do Delta: validação de coleções, índices, roles de acesso, dados de desenvolvimento e migrations versionadas. As rotinas separam telemetria de alto volume dos dados de apoio à aplicação.

**Tags:** `delta` · `mongodb` · `nosql` · `schema-validation` · `indexes` · `migrations` · `telemetria-iot`

## Sumário

- [Visão geral](#visão-geral)
- [Bancos e coleções](#bancos-e-coleções)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Instalação e validação local](#instalação-e-validação-local)
- [Scripts de bootstrap](#scripts-de-bootstrap)
- [Migrations incrementais](#migrations-incrementais)
- [CI e documentação](#ci-e-documentação)
- [Repositórios relacionados](#repositórios-relacionados)

## Visão geral

| Banco | Finalidade | Coleções versionadas nos scripts de bootstrap |
|---|---|---|
| `db_delta_telemetry` | Resumos de consumo enviados pelo hardware e estado corrente dos dispositivos. | `consumption_summary`, `device_status` |
| `db_delta_app` | Preferências, alertas, conversas e dados de clima consumidos pela aplicação. | `user_preferences`, `alerts_history`, `chat_sessions`, `chat_feedback`, `weather_daily` |

Os scripts de coleções aplicam validação por JSON Schema; os scripts de índices definem as chaves de busca, unicidade e retenção presentes no contrato atual. Os dados `user_id` e `device_id` são referências lógicas a outros bancos do Delta, sem foreign key entre MongoDB e PostgreSQL.

`consumption_summary` recebe consumo consolidado pelo hardware e não tem TTL configurado nos scripts. `device_status` mantém um documento corrente por dispositivo. `chat_sessions` guarda mensagens embutidas; `weather_daily` agrupa observações por localização e dia, usando `weather_date` e `wind_speed_mps`.

## Bancos e coleções

| Coleção | Banco | Papel |
|---|---|---|
| `consumption_summary` | `db_delta_telemetry` | Janela de consumo consolidada por dispositivo e usuário. |
| `device_status` | `db_delta_telemetry` | Estado mais recente comunicado pelo dispositivo. |
| `user_preferences` | `db_delta_app` | Preferências do usuário na aplicação. |
| `alerts_history` | `db_delta_app` | Histórico de alertas e seus estados. |
| `chat_sessions` | `db_delta_app` | Sessões e mensagens embutidas no padrão bucket. |
| `chat_feedback` | `db_delta_app` | Avaliação associada logicamente a uma sessão. |
| `weather_daily` | `db_delta_app` | Dados meteorológicos diários e observações horárias. |

Detalhes de campos, validação, índices e exemplos de consulta estão em [telemetria](collections/db_delta_telemetry.md) e [dados do app](collections/db_delta_app.md).

## Estrutura do repositório

~~~text
delta-mongo-database/
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── migrations.yml
├── scripts/
│   ├── migrate.js
│   ├── delta-telemetry/
│   │   ├── script-collections.js
│   │   ├── script-indexes.js
│   │   ├── script-roles.js
│   │   └── script-seed.js
│   └── delta-app/
│       ├── script-collections.js
│       ├── script-indexes.js
│       ├── script-roles.js
│       └── script-seed.js
├── migrations/
│   └── contract-baseline-0001.json
├── tests/
│   ├── smoke.js
│   └── migration-runner.test.js
├── collections/
│   ├── db_delta_telemetry.md
│   └── db_delta_app.md
├── docker-compose.test.yml
├── package.json
├── QUICK_START.md
├── migrations.md
└── DOCKER-HELP.md
~~~

## Instalação e validação local

Requisitos: Node.js `20.19` ou superior para o pacote, npm e Docker Engine com Docker Compose v2 para os testes MongoDB descartáveis. O compose usa MongoDB 7 e não publica portas nem persiste o banco de teste.

Instale as dependências travadas e rode a suíte Node:

~~~bash
npm ci
npm test
~~~

Para conferir a configuração e executar os smoke checks contra uma instância temporária:

~~~bash
docker compose -p delta-mongo-database-test -f docker-compose.test.yml config --quiet
docker compose -p delta-mongo-database-test -f docker-compose.test.yml run --rm runner
docker compose -p delta-mongo-database-test -f docker-compose.test.yml down
~~~

O runner aplica coleções e índices de ambos os bancos e executa `tests/smoke.js`. O serviço `migration-test` também pode ser executado com o perfil `migrations`; o workflow de CI usa esse serviço para validar o baseline e o runner de migrations:

~~~bash
docker compose -p delta-mongo-database-test -f docker-compose.test.yml --profile migrations run --rm migration-test
docker compose -p delta-mongo-database-test -f docker-compose.test.yml down
~~~

Esses comandos usam apenas dados descartáveis locais. Consulte [DOCKER-HELP.md](DOCKER-HELP.md) para diagnóstico e limpeza segura.

## Scripts de bootstrap

Cada banco tem seu próprio conjunto de scripts. Para uma instalação inicial, a ordem de preparo é:

1. `script-collections.js`: cria coleções e validadores.
2. `script-indexes.js`: instala índices de consulta, unicidade e retenção definidos no contrato.
3. `script-roles.js`: provisiona Custom Roles para o Atlas, de acordo com a política do banco.
4. `script-seed.js`: carrega dados de desenvolvimento; execute somente em banco descartável ou ambiente explicitamente aprovado.

Os scripts de roles e seeds não fazem parte do smoke runner de testes. Para conexão, comandos `mongosh` e setup manual no Atlas, siga [QUICK_START.md](QUICK_START.md). Não aplique scripts de bootstrap como atualização de um banco já em uso.

## Migrations incrementais

A pasta `migrations/` contém o snapshot inicial imutável `0001`; ainda não há migration de negócio `0002`. O runner registra versões, checksums, estado parcial e lock no banco de controle `delta_migration_control`. Ele não transforma os scripts de bootstrap em migrations.

Para consultar um destino previamente selecionado, configure `MONGO_MIGRATION_URI` sem imprimir nem versionar o valor e use:

~~~bash
npm run migrate -- status
npm run migrate -- check-baseline
~~~

`up` aplica migrations pendentes ao banco indicado pela URI. É uma operação sobre estado persistente; use apenas após conferir o ambiente, a versão atual, o backup e a autorização. As regras de baseline, recuperação e workflow manual estão detalhadas em [migrations.md](migrations.md). O workflow de migrations é executado manualmente na branch `main`, com secrets de ambiente; não é disparado pela PR.

## CI e documentação

O workflow `test.yml` executa smoke checks de schema/índices e testes do runner em MongoDB descartável durante Pull Requests. `migrations.yml` oferece operações manuais de consulta, baseline e aplicação. A execução de CI não comprova compatibilidade com um cluster Atlas específico nem que migrations persistentes foram aplicadas.

- [Quick Start](QUICK_START.md): preparação inicial e exemplos de acesso.
- [Migrations](migrations.md): baseline, execução, checksums e recuperação.
- [Docker Help](DOCKER-HELP.md): comandos do ambiente local.
- [Coleções de telemetria](collections/db_delta_telemetry.md) e [coleções do app](collections/db_delta_app.md): contratos detalhados.

## Repositórios relacionados

- [delta-api-mongo](https://github.com/delta-app-ofc/delta-api-mongo): API de ingestão e consulta da telemetria.
- [delta-business-rules](https://github.com/delta-app-ofc/delta-business-rules): regras determinísticas sobre consumo e alertas.
- [delta-handbook](https://github.com/delta-app-ofc/delta-handbook): visão geral da arquitetura e regras de dados.
