/**
 * Atualiza SOMENTE o validator e o índice de coordenadas de weather_daily.
 * Cole o arquivo inteiro no mongosh integrado do Compass, conectado ao cluster app.
 * Não cria coleções, não insere seed e não altera documentos existentes.
 */
/* global db, print */
(() => {
  const appDb = db.getSiblingDB("db_delta_app");
  const info = appDb.getCollectionInfos({ name: "weather_daily" })[0];
  if (!info) {
    throw new Error("weather_daily não existe em db_delta_app. Use o setup inicial de coleções.");
  }
  const validator = info.options.validator;
  const location = validator?.$jsonSchema?.properties?.location;
  if (!location?.properties) {
    throw new Error("Validator de weather_daily não tem o contrato location esperado; atualização interrompida.");
  }

  location.properties.latitude = {
    bsonType: ["double", "int", "long", "decimal"],
    minimum: -90,
    maximum: 90,
    description: "Latitude WGS84 do ponto consultado pela API de clima; informar junto com longitude"
  };
  location.properties.longitude = {
    bsonType: ["double", "int", "long", "decimal"],
    minimum: -180,
    maximum: 180,
    description: "Longitude WGS84 do ponto consultado pela API de clima; informar junto com latitude"
  };
  location.dependencies = {
    ...location.dependencies,
    latitude: ["longitude"],
    longitude: ["latitude"]
  };

  const result = appDb.runCommand({
    collMod: "weather_daily",
    validator,
    validationLevel: info.options.validationLevel || "moderate",
    validationAction: info.options.validationAction || "error"
  });
  if (result.ok !== 1) {
    throw new Error("collMod falhou; confira o retorno e as permissões do usuário.");
  }

  appDb.weather_daily.createIndex(
    { "location.latitude": 1, "location.longitude": 1, weather_date: -1 },
    {
      name: "idx_weather_coordinates_date",
      partialFilterExpression: {
        "location.latitude": { $type: "number" },
        "location.longitude": { $type: "number" }
      }
    }
  );
  print("✓ weather_daily aceita location.latitude e location.longitude como par opcional.");
  print("✓ Índice de coordenadas criado. Nenhum documento ou seed foi inserido/alterado.");
})();
