# Docker — delta-mongo-database

## Objetivo

Aplicar os scripts locais de collections e indexes e executar os smoke checks.

## Pré-requisitos

Docker Engine em execução e Docker Compose v2. Execute os comandos na raiz deste repositório. Os exemplos usam uma identificação de projeto própria para isolar containers e volumes.

## Executar

```bash
docker compose -p delta-mongo-database-test -f docker-compose.test.yml config --quiet
docker compose -p delta-mongo-database-test -f docker-compose.test.yml run --rm runner
docker compose -p delta-mongo-database-test -f docker-compose.test.yml down
```

## Conferir o resultado e encerrar

O runner deve terminar com código zero e `MongoDB local smoke checks passed.`. Roles Atlas e seeds não são executados. Não precisa de URI Atlas ou `.env`; não há porta publicada ou volume persistente de dados.

Para diagnosticar falhas de um serviço Compose, use `docker compose -p <projeto> -f <arquivo> ps -a` e `docker compose -p <projeto> -f <arquivo> logs <serviço>`, com o mesmo projeto e arquivo da execução.

`down` preserva volumes nomeados. Só use `down -v` depois de conferir o nome do projeto e confirmar que seus dados são descartáveis. Não remova volumes de outros ambientes.
