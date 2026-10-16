/**
 * Atualização manual no mongosh do Compass. Não insere nem altera documentos.
 * Os campos continuam opcionais para documentos antigos. Reexecutável.
 * As duas coleções são verificadas antes de qualquer collMod; não há transação entre bancos.
 */
/* global db, print */
(() => {
  const messageFields = {
  "agent_name": {
    "bsonType": "string",
    "minLength": 1,
    "description": "Especialista responsável pela resposta, sem incluir juiz ou roteador"
  },
  "response_time_ms": {
    "bsonType": [
      "int",
      "long"
    ],
    "minimum": 0,
    "description": "Duração da execução do especialista em milissegundos, medida pelo backend"
  }
};
  const messageDependencies = {
  "agent_name": [
    "response_time_ms"
  ],
  "response_time_ms": [
    "agent_name"
  ]
};
  const deviceFields = {
  "availability_started_at": {
    "bsonType": "date",
    "description": "Início do período coberto pelo contador e pelas indisponibilidades"
  },
  "availability_updated_at": {
    "bsonType": "date",
    "description": "Instante até o qual os tempos foram contabilizados pelo backend"
  },
  "available_seconds": {
    "bsonType": [
      "int",
      "long"
    ],
    "minimum": 0,
    "description": "Tempo online acumulado, em segundos, no período de disponibilidade"
  },
  "unavailabilities": {
    "bsonType": "array",
    "description": "Intervalos de indisponibilidade contabilizados no mesmo período",
    "items": {
      "bsonType": "object",
      "required": [
        "started_at",
        "ended_at",
        "unavailable_seconds",
        "unavailability_reason"
      ],
      "properties": {
        "started_at": {
          "bsonType": "date"
        },
        "ended_at": {
          "bsonType": [
            "date",
            "null"
          ],
          "description": "null enquanto a indisponibilidade estiver aberta"
        },
        "unavailable_seconds": {
          "bsonType": [
            "int",
            "long"
          ],
          "minimum": 0,
          "description": "Segundos até ended_at, ou availability_updated_at quando aberta"
        },
        "unavailability_reason": {
          "bsonType": [
            "string",
            "null"
          ],
          "description": "Motivo do intervalo; null quando desconhecido"
        }
      }
    }
  }
};
  const deviceDependencies = {
  "available_seconds": [
    "availability_started_at",
    "availability_updated_at",
    "unavailabilities"
  ],
  "availability_started_at": [
    "available_seconds"
  ],
  "availability_updated_at": [
    "available_seconds"
  ],
  "unavailabilities": [
    "available_seconds"
  ]
};
  const targets = [
    { database: 'db_delta_app', collection: 'chat_sessions' },
    { database: 'db_delta_telemetry', collection: 'device_status' }
  ];
  // Preflight: não recria coleções nem substitui validadores desconhecidos.
  const prepared = targets.map(target => {
    const database = db.getSiblingDB(target.database);
    const info = database.getCollectionInfos({ name: target.collection })[0];
    if (!info || !info.options || !info.options.validator || !info.options.validator.$jsonSchema) {
      throw new Error(target.database + '.' + target.collection + ': coleção ou $jsonSchema não encontrado');
    }
    const validator = info.options.validator;
    const schema = validator.$jsonSchema;
    if (!schema.properties) throw new Error('Schema sem properties: ' + target.collection);
    if (target.collection === 'chat_sessions') {
      const items = schema.properties.messages && schema.properties.messages.items;
      if (!items || items.bsonType !== 'object' || !items.properties) {
        throw new Error('chat_sessions.messages.items precisa ser um objeto com properties');
      }
      delete items.properties.response_time_is_mock;
      if (items.dependencies) delete items.dependencies.response_time_is_mock;
      Object.assign(items.properties, messageFields);
      items.dependencies = Object.assign({}, items.dependencies, messageDependencies);
    } else {
      delete schema.properties.availability_is_mock;
      delete schema.properties.unavailability_reason;
      if (schema.dependencies) delete schema.dependencies.availability_is_mock;
      Object.assign(schema.properties, deviceFields);
      schema.dependencies = Object.assign({}, schema.dependencies, deviceDependencies);
    }
    return { database, command: {
      collMod: target.collection,
      validator,
      validationLevel: info.options.validationLevel || 'strict',
      validationAction: info.options.validationAction || 'error'
    }, label: target.database + '.' + target.collection };
  });
  for (const target of prepared) {
    const result = target.database.runCommand(target.command);
    if (result.ok !== 1) throw new Error('Falha em collMod: ' + target.label);
    print('Validator atualizado: ' + target.label + '; nenhum documento modificado.');
  }
})();
