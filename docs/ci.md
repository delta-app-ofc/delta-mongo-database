# CI MongoDB

Em pull requests e execuções manuais, o workflow inicia um MongoDB descartável pelo Docker Compose, aplica os scripts de coleções e índices e executa `tests/smoke.js`. O teste verifica a existência das coleções, validadores e índices listados e a rejeição de um documento inválido em `user_preferences`.

Para executar localmente, com Docker Engine e Compose v2 ativos, na raiz do repositório:

```bash
docker compose -p delta-mongo-ci -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from runner
docker compose -p delta-mongo-ci -f docker-compose.test.yml down
```

O teste não acessa Atlas, não executa roles ou seeds e não cobre todos os comportamentos dos schemas. O ambiente não publica portas nem persiste dados.
