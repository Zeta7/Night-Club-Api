UPDATE "LaunchMarket" SET "name" = 'Lima' WHERE "slug" = 'lima';
UPDATE "LaunchMarket" SET "name" = 'La Libertad', "slug" = 'la-libertad' WHERE "slug" = 'trujillo';
UPDATE "LaunchMarket" SET "name" = 'San Martín', "slug" = 'san-martin' WHERE "slug" = 'tocache';

UPDATE "LaunchMarketUbigeo" AS mapping
SET
  "provinceId" = NULL,
  "districtId" = NULL,
  "ubigeoCode" = NULL,
  "mappingKey" = mapping."departmentId"::text || ':*:*'
FROM "LaunchMarket" AS market
WHERE mapping."marketId" = market."id"
  AND market."slug" IN ('lima', 'la-libertad', 'arequipa', 'san-martin');
