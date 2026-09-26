const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Prisma } = require('@prisma/client');

const ROOT = path.resolve(__dirname, '..');
function generateResponseSchemas(program) {
  const checker = program.getTypeChecker();
  const schemas = {};
  const unresolvedTypes = new Set();
  const errorCodes = {};
  const NEVER_SCHEMA = Object.freeze({ 'x-generated-never': true });
  const NULL_SCHEMA = Object.freeze({ 'x-generated-null': true });

  const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Sse']);
  const ERROR_HELPERS = {
    badRequest: '400',
    unauthorized: '401',
    forbidden: '403',
    notFound: '404',
    conflict: '409',
    serviceUnavailable: '503',
  };
  const RESPONSE_SCHEMA_EXCLUSIONS = new Set([
    'CapacityController_stream',
    'CommerceController_exportClubOrders',
  ]);

  function decoratorsOf(node) {
    return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
  }

  function decoratorName(decorator) {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      return ts.isIdentifier(expression.expression) ? expression.expression.text : undefined;
    }
    return ts.isIdentifier(expression) ? expression.text : undefined;
  }

  function isOpenApiController(node) {
    return !decoratorsOf(node).some(
      (decorator) => decoratorName(decorator) === 'ApiExcludeController',
    );
  }

  function isHttpMethod(node) {
    return decoratorsOf(node).some((decorator) => HTTP_DECORATORS.has(decoratorName(decorator)));
  }

  function words(value) {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase();
  }

  function descriptionFor(name) {
    const known = {
      amountCents: 'Importe expresado en céntimos.',
      totalCents: 'Importe total expresado en céntimos.',
      createdAt: 'Fecha y hora de creación en formato ISO 8601.',
      updatedAt: 'Fecha y hora de la última actualización en formato ISO 8601.',
      id: 'Identificador del recurso.',
      message: 'Mensaje legible que resume el resultado.',
      status: 'Estado actual expuesto por el runtime.',
    };
    return known[name] ?? `Campo ${words(name)} expuesto por el runtime actual.`;
  }

  const UUID_EXAMPLES = {
    id: '7e6b8c1f-1a42-4d95-9f63-8c2b7a4e5d10',
    userId: '3c79f4a2-6e51-4b8a-9d27-1f5a0c83e642',
    clubId: '8f24c1d7-5b39-4a6e-92d8-7c3f1a5b604e',
    eventId: 'a6d9e2f4-7c31-4b58-8f20-5e1a9d63c742',
    productId: '5b8e1c93-2d64-4fa7-a318-9c6e42d075bf',
    promotionId: 'd2a7f951-8c43-4e60-b195-6f3d28a7c014',
    orderId: 'c4e91a67-3b58-4fd2-8a06-7d25e9c1b340',
    paymentAttemptId: '9d3b7e15-6a42-4c98-b571-2f8e0a63d4c9',
    uploadId: 'f7a2c864-1d39-4e5b-90a6-3c8d27b154ef',
    workerId: '2e8c5a71-9b34-4d60-a192-6f7e3c48b025',
    shiftId: '6a1d9f42-3c75-4e8b-b206-5d7a91c4f638',
    deviceId: 'b3f7c216-8a59-4d40-9e15-2c6a74f893bd',
    ticketTypeId: 'e5c2a831-7d49-4b60-a918-3f6e25d7c104',
    ticketId: '4a9e7c32-6b15-4d80-8f24-1c5e93a7b642',
    notificationId: '1c6e8a42-9f35-4d70-b821-5a3c97e4d608',
    referralId: '7b2d5e91-4a68-4c30-9f15-2e8a63d7b049',
    transactionId: '0f8c2a75-6d41-4b93-a527-9e3d16c8f204',
    walletId: '5d7a1c84-3e69-4f20-8b15-6c2e97a4d038',
  };

  function uuidExample(name, context = []) {
    const fields = new Set(context);
    if (name === 'id') {
      if (fields.has('platform') || fields.has('fingerprint')) return UUID_EXAMPLES.deviceId;
      if (fields.has('stockQuantity')) return UUID_EXAMPLES.productId;
      if (fields.has('pricingMode') || fields.has('itemsCount')) return UUID_EXAMPLES.promotionId;
      if (fields.has('quantityTotal') || fields.has('perUserLimit')) {
        return UUID_EXAMPLES.ticketTypeId;
      }
      if (fields.has('startsAt') || fields.has('endsAt')) return UUID_EXAMPLES.eventId;
      if (fields.has('totalCents') || fields.has('paymentMethod')) return UUID_EXAMPLES.orderId;
      if (fields.has('phoneNumber') || fields.has('email')) return UUID_EXAMPLES.userId;
      if (fields.has('address') || fields.has('admins') || fields.has('coverImage')) {
        return UUID_EXAMPLES.clubId;
      }
    }
    if (UUID_EXAMPLES[name]) return UUID_EXAMPLES[name];
    const match = Object.keys(UUID_EXAMPLES).find(
      (key) => key !== 'id' && name.toLowerCase().includes(key.replace(/Id$/, '').toLowerCase()),
    );
    return (match && UUID_EXAMPLES[match]) || UUID_EXAMPLES.id;
  }

  function uriExample(name, context = []) {
    if (/uploadUrl/i.test(name)) {
      return 'https://nightclub-platform-assets.s3.amazonaws.com/uploads/2026/08/nebula-cover.webp?X-Amz-Expires=300';
    }
    if (/checkoutUrl/i.test(name)) {
      return 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=123456789-abcd1234-5678-90ab-cdef-1234567890ab';
    }
    if (/shareUrl/i.test(name)) return 'https://beerry.app/eventos/noche-latina';
    if (/proofUrl/i.test(name)) {
      return 'https://cdn.beerry.app/withdrawals/comprobante-2026-0042.pdf';
    }
    if (/attendee|profile|user/i.test(name)) {
      return 'https://cdn.beerry.app/users/valeria/profile.webp';
    }
    const fields = new Set(context);
    if (fields.has('objectKey')) {
      return 'https://cdn.beerry.app/uploads/2026/08/nebula-cover.webp';
    }
    if (fields.has('stockQuantity')) {
      return 'https://cdn.beerry.app/products/chilcano-maracuya.webp';
    }
    if (fields.has('pricingMode') || fields.has('itemsCount')) {
      return 'https://cdn.beerry.app/promotions/combo-bienvenida.webp';
    }
    if (fields.has('startsAt') || fields.has('endsAt')) {
      return 'https://cdn.beerry.app/events/noche-latina/cover.webp';
    }
    return 'https://cdn.beerry.app/clubs/nebula/cover.webp';
  }

  function tokenExample(name, context = []) {
    if (/tokenType/i.test(name)) return 'Bearer';
    if (/refresh/i.test(name)) return 'rft_7Kp4mN9xQ2vL8sD5cB1hJ6wF3aR0';
    if (/access/i.test(name)) {
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzc5ZjRhMi02ZTUxLTRiOGEtOWQyNy0xZjVhMGM4M2U2NDIifQ.W7sP2kQ9mR4vN8xL1cD6';
    }
    const fields = new Set(context);
    if (fields.has('platform') || fields.has('deviceId')) {
      return 'dQw4w9WgXcQ:APA91bG7Kp4mN9xQ2vL8sD5cB1hJ6wF3aR0eT7uY2iO9pA4sD8fG1hJ5kL3zX6cV0bN2mQ';
    }
    return 'tok_8f3d1c7a6b2e4f90a5d8c1e7';
  }

  function dateTimeExample(name) {
    if (/createdAt/i.test(name)) return '2026-08-27T18:30:00.000Z';
    if (/updatedAt/i.test(name)) return '2026-08-28T14:15:00.000Z';
    if (/approvedAt|paidAt/i.test(name)) return '2026-09-19T22:05:00.000Z';
    if (/endsAt|saleEndAt|\bto\b/i.test(name)) return '2026-09-20T05:00:00.000Z';
    if (/saleStartAt/i.test(name)) return '2026-09-01T12:00:00.000Z';
    return '2026-09-19T22:00:00.000Z';
  }

  function nameExample(name, context = []) {
    if (/club|legal/i.test(name)) return 'Nébula Club';
    if (/event/i.test(name)) return 'Noche Latina';
    if (/product|snapshot/i.test(name)) return 'Chilcano de maracuyá';
    if (/attendee|actor|referrer|responsible|validated|fullName|accessName/i.test(name)) {
      return 'Valeria Mendoza';
    }
    const fields = new Set(context);
    if (fields.has('platform') || fields.has('fingerprint')) return 'iPhone 15 Pro de Valeria';
    if (fields.has('stockQuantity')) return 'Chilcano de maracuyá';
    if (fields.has('pricingMode') || fields.has('itemsCount')) return 'Combo de bienvenida';
    if (fields.has('quantityTotal') || fields.has('perUserLimit')) return 'Entrada VIP';
    if (fields.has('startsAt') || fields.has('endsAt')) return 'Noche Latina';
    return 'Nébula Club';
  }

  function codeExample(name) {
    if (/referral|snapshot/i.test(name)) return 'VALERIA25';
    if (/failure/i.test(name)) return 'PAYMENT_DECLINED';
    if (/qr/i.test(name)) return 'BRY-TKT-8K4M2P';
    return 'BRY-8K4M2P';
  }

  function exampleFor(name, schema, context) {
    if (schema.enum?.length) return schema.enum[0];
    if (schema.format === 'uuid') return uuidExample(name, context);
    if (schema.format === 'date-time') return dateTimeExample(name);
    if (schema.format === 'date') return '2026-09-19';
    if (schema.format === 'email') return 'valeria.mendoza@correo.pe';
    if (schema.format === 'uri') return uriExample(name, context);
    if (/token/i.test(name)) return tokenExample(name, context);
    if (/phoneNumber/i.test(name)) return '987654321';
    if (/phoneCountryCode/i.test(name)) return '+51';
    if (/Cents$/.test(name)) return 1500;
    if (/count|quantity|page|total|version/i.test(name) && schema.type === 'number') return 1;
    if (/name/i.test(name) && schema.type === 'string') return nameExample(name, context);
    if (/code/i.test(name) && schema.type === 'string') return codeExample(name);
    if (schema.type === 'boolean') return false;
    return undefined;
  }

  function propertyMetadata(declaration, seen = new Set()) {
    if (!declaration || seen.has(declaration)) return {};
    seen.add(declaration);
    if (ts.getJSDocTags(declaration).some((tag) => tag.tagName.text === 'integer'))
      return { type: 'integer' };
    if (/[\\/]\.prisma[\\/]client[\\/]/.test(declaration.getSourceFile().fileName)) {
      let owner = declaration.parent;
      while (owner && !ts.isTypeAliasDeclaration(owner)) owner = owner.parent;
      const name = owner?.name.text ?? '';
      if (name.endsWith('CountAggregateOutputType') || name === 'BatchPayload')
        return { type: 'integer' };
      const modelName =
        /^\$(.+)Payload$/.exec(name)?.[1] ??
        /^(.+?)(?:Sum|Min|Max)AggregateOutputType$/.exec(name)?.[1];
      const model = Prisma.dmmf.datamodel.models.find((model) => model.name === modelName);
      const field = model?.fields.find((field) => field.name === declaration.name?.getText());
      if (field?.type === 'Int') return { type: 'integer' };
    }
    if (ts.isPropertyAssignment(declaration))
      return expressionMetadata(declaration.initializer, seen);
    if (ts.isShorthandPropertyAssignment(declaration)) {
      const symbol = checker.getShorthandAssignmentValueSymbol(declaration);
      return propertyMetadata(symbol?.valueDeclaration, seen);
    }
    if (ts.isVariableDeclaration(declaration) && declaration.initializer)
      return expressionMetadata(declaration.initializer, seen);
    return {};
  }

  function expressionMetadata(expression, seen) {
    if (
      ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === 'toISOString'
    ) {
      const receiver = checker.getNonNullableType(
        checker.getTypeAtLocation(expression.expression.expression),
      );
      if (receiver.getSymbol()?.name === 'Date') return { type: 'string', format: 'date-time' };
    }
    if (ts.isPropertyAccessExpression(expression)) {
      if (
        expression.name.text === 'length' &&
        checker.isArrayType(checker.getTypeAtLocation(expression.expression))
      )
        return { type: 'integer' };
      return propertyMetadata(checker.getSymbolAtLocation(expression.name)?.valueDeclaration, seen);
    }
    if (ts.isIdentifier(expression))
      return propertyMetadata(checker.getSymbolAtLocation(expression)?.valueDeclaration, seen);
    if (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression))
      return expressionMetadata(expression.expression, seen);
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return expressionMetadata(expression.left, seen);
    }
    return {};
  }

  function dynamicValueSchema(
    description = 'Valor JSON dinámico expuesto por el runtime.',
    nullable = false,
  ) {
    return {
      description,
      allOf: [{ $ref: '#/components/schemas/JsonValue' }],
      ...(nullable ? { nullable: true } : {}),
    };
  }

  function documentedObject(properties, optional = []) {
    const propertyNames = Object.keys(properties);
    for (const [name, schema] of Object.entries(properties)) {
      schema.description ??= descriptionFor(name);
      const example = exampleFor(name, schema, propertyNames);
      if (example !== undefined && schema.example === undefined) schema.example = example;
    }
    return {
      type: 'object',
      properties,
      ...(propertyNames.some((name) => !optional.includes(name))
        ? { required: propertyNames.filter((name) => !optional.includes(name)) }
        : {}),
      additionalProperties: false,
    };
  }

  function nullableSchema(schema) {
    if (isNullOnlySchema(schema)) return schema;
    if (isDynamicSchema(schema)) return { ...schema, nullable: true };
    if (schema.oneOf) return { ...schema, oneOf: schema.oneOf.map(nullableSchema) };
    if (schema.anyOf) return { ...schema, anyOf: schema.anyOf.map(nullableSchema) };
    if (schema.type)
      return {
        ...schema,
        nullable: true,
        ...(schema.enum ? { enum: [...new Set([...schema.enum, null])] } : {}),
      };
    return dynamicValueSchema();
  }

  function isDynamicSchema(schema) {
    return schema?.allOf?.some((item) => item.$ref === '#/components/schemas/JsonValue');
  }

  function isNullOnlySchema(schema) {
    return (
      schema === NULL_SCHEMA ||
      schema?.['x-generated-null'] === true ||
      (isDynamicSchema(schema) && schema.description === 'Valor null expuesto por el runtime.')
    );
  }

  function isNeverSchema(schema) {
    return schema === NEVER_SCHEMA || schema?.['x-generated-never'] === true;
  }

  // A stable object model keeps optional branch fields usable by generated SDKs.
  function objectUnionSchema(variants) {
    const names = [
      ...new Set(variants.flatMap((variant) => Object.keys(variant.properties ?? {}))),
    ];
    const properties = Object.fromEntries(
      names.map((name) => [
        name,
        mergeSchemaVariants(variants.map((variant) => variant.properties?.[name]).filter(Boolean)),
      ]),
    );
    return {
      ...documentedObject(
        properties,
        names.filter((name) => !variants.every((variant) => variant.required?.includes(name))),
      ),
      ...(variants.some((variant) => variant.nullable) ? { nullable: true } : {}),
    };
  }

  function mergeSchemaVariants(variants) {
    const possible = variants.filter((schema) => !isNeverSchema(schema));
    if (possible.length === 0) return NEVER_SCHEMA;
    const unique = [...new Map(possible.map((item) => [JSON.stringify(item), item])).values()];
    if (unique.length === 1) return unique[0];

    const withoutNull = unique.filter((schema) => !isNullOnlySchema(schema));
    if (withoutNull.length !== unique.length && withoutNull.length > 0) {
      return nullableSchema(mergeSchemaVariants(withoutNull));
    }

    const dynamic = unique.find(isDynamicSchema);
    if (dynamic) return dynamic;

    if (unique.every((schema) => schema.type === 'object')) {
      return objectUnionSchema(unique);
    }

    if (unique.every((schema) => schema.type === 'array')) {
      return {
        type: 'array',
        items: mergeSchemaVariants(unique.map((schema) => schema.items)),
        ...(unique.some((schema) => schema.nullable) ? { nullable: true } : {}),
      };
    }

    const types = new Set(unique.map((schema) => schema.type));
    if (types.size === 1 && !types.has(undefined)) {
      const [first] = unique;
      const merged = { ...first };
      const enumValues = unique.flatMap((schema) => schema.enum ?? []);
      if (unique.every((schema) => Array.isArray(schema.enum)))
        merged.enum = [...new Set(enumValues)];
      else delete merged.enum;
      if (unique.some((schema) => schema.nullable)) merged.nullable = true;
      if (unique.some((schema) => schema.format !== first.format)) delete merged.format;
      return merged;
    }

    if (unique.every((schema) => ['integer', 'number'].includes(schema.type)))
      return {
        type: 'number',
        ...(unique.some((schema) => schema.nullable) ? { nullable: true } : {}),
      };
    return { anyOf: unique };
  }

  function typeToSchema(type, location, depth = 0, stack = new Set()) {
    const flags = type.flags;
    const jsonName = type.aliasSymbol?.name ?? type.getSymbol()?.name;
    if (
      [
        'JsonValue',
        'JsonObject',
        'JsonArray',
        'InputJsonValue',
        'InputJsonObject',
        'InputJsonArray',
      ].includes(jsonName)
    ) {
      if (jsonName.endsWith('Object'))
        return { type: 'object', additionalProperties: dynamicValueSchema() };
      if (jsonName.endsWith('Array')) return { type: 'array', items: dynamicValueSchema() };
      return dynamicValueSchema(undefined, jsonName === 'JsonValue');
    }
    if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      const file = location.getSourceFile();
      const line = file.getLineAndCharacterOfPosition(location.getStart()).line + 1;
      unresolvedTypes.add(
        path.relative(ROOT, file.fileName) + ':' + line + ' ' + location.getText().slice(0, 160),
      );
      return dynamicValueSchema();
    }
    if (flags & ts.TypeFlags.Never) return NEVER_SCHEMA;
    if (flags & ts.TypeFlags.StringLike) {
      if (type.isStringLiteral?.()) return { type: 'string', enum: [type.value] };
      return { type: 'string' };
    }
    if (flags & ts.TypeFlags.NumberLike) {
      if (type.isNumberLiteral?.()) return { type: 'number', enum: [type.value] };
      return { type: 'number' };
    }
    if (flags & ts.TypeFlags.BooleanLike) {
      const intrinsic = type.intrinsicName;
      return intrinsic === 'true' || intrinsic === 'false'
        ? { type: 'boolean', enum: [intrinsic === 'true'] }
        : { type: 'boolean' };
    }
    if (flags & ts.TypeFlags.BigIntLike) return { type: 'integer', format: 'int64' };
    if (flags & ts.TypeFlags.Null) return NULL_SCHEMA;
    if (flags & ts.TypeFlags.Undefined) return dynamicValueSchema();

    if (type.isUnion?.()) {
      const hasNull = type.types.some((item) => item.flags & ts.TypeFlags.Null);
      const meaningful = type.types.filter(
        (item) => !(item.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)),
      );
      const memberNames = new Set(
        meaningful.map((item) => item.aliasSymbol?.name ?? item.getSymbol()?.name),
      );
      // Excluding null from Prisma.JsonValue removes its alias but keeps the JSON object and array members.
      if (
        memberNames.has('JsonObject') &&
        memberNames.has('JsonArray') &&
        meaningful.every(
          (item) =>
            Boolean(
              item.flags &
              (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike),
            ) ||
            ['JsonObject', 'JsonArray'].includes(item.aliasSymbol?.name ?? item.getSymbol()?.name),
        )
      )
        return dynamicValueSchema(undefined, hasNull);
      const stringLiterals = meaningful.filter((item) => item.isStringLiteral?.());
      const numberLiterals = meaningful.filter((item) => item.isNumberLiteral?.());
      if (stringLiterals.length === meaningful.length) {
        return {
          type: 'string',
          enum: [...stringLiterals.map((item) => item.value), ...(hasNull ? [null] : [])],
          ...(hasNull ? { nullable: true } : {}),
        };
      }
      if (numberLiterals.length === meaningful.length) {
        return {
          type: 'number',
          enum: [...numberLiterals.map((item) => item.value), ...(hasNull ? [null] : [])],
          ...(hasNull ? { nullable: true } : {}),
        };
      }
      const variants = meaningful.map((item) => typeToSchema(item, location, depth, stack));
      const unique = [...new Map(variants.map((item) => [JSON.stringify(item), item])).values()];
      const dynamic = unique.find(isDynamicSchema);
      if (dynamic) return hasNull ? nullableSchema(dynamic) : dynamic;
      if (unique.length === 1) return hasNull ? nullableSchema(unique[0]) : unique[0];
      const merged = mergeSchemaVariants(unique);
      return hasNull ? nullableSchema(merged) : merged;
    }

    const promised = checker.getPromisedTypeOfPromise(type);
    if (promised) return typeToSchema(promised, location, depth, stack);
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      const arguments_ = checker.getTypeArguments(type);
      const itemType = arguments_[0] ?? checker.getIndexTypeOfType(type, ts.IndexKind.Number);
      return {
        type: 'array',
        items: itemType ? typeToSchema(itemType, location, depth + 1, stack) : dynamicValueSchema(),
      };
    }

    const symbolName = type.aliasSymbol?.name ?? type.getSymbol()?.name;
    const rendered = checker.typeToString(type, location);
    if (symbolName === 'Date' || rendered === 'Date')
      return { type: 'string', format: 'date-time' };
    if (symbolName === 'URL') return { type: 'string', format: 'uri' };
    if (
      [
        'JsonValue',
        'JsonObject',
        'JsonArray',
        'InputJsonValue',
        'InputJsonObject',
        'InputJsonArray',
      ].includes(symbolName) ||
      /^(?:Prisma\.)?(?:Input)?Json(?:Value|Object|Array)$/.test(rendered)
    ) {
      return dynamicValueSchema();
    }
    if (depth >= 50)
      throw new Error(
        'Response nesting exceeds the supported depth at ' + location.getText().slice(0, 100),
      );

    const identity = type.id;
    if (stack.has(identity)) {
      throw new Error('Recursive response requires an explicit JSON contract: ' + rendered);
    }
    const nextStack = new Set(stack).add(identity);
    const properties = {};
    const required = [];
    const typeProperties = checker.getPropertiesOfType(type);
    const propertyNames = typeProperties.map((property) => property.name);
    for (const property of typeProperties) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
      const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
      if (propertyType.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Never)) continue;
      const schema = typeToSchema(propertyType, declaration, depth + 1, nextStack);
      if (schema.type === 'number' || schema.type === 'string')
        Object.assign(schema, propertyMetadata(declaration));
      schema.description ??= descriptionFor(property.name);
      const example = exampleFor(property.name, schema, propertyNames);
      if (example !== undefined) schema.example = example;
      properties[property.name] = schema;
      const optional =
        Boolean(property.flags & ts.SymbolFlags.Optional) ||
        (propertyType.isUnion?.() &&
          propertyType.types.some((item) => item.flags & ts.TypeFlags.Undefined));
      if (!optional) required.push(property.name);
    }

    const stringIndex = checker.getIndexTypeOfType(type, ts.IndexKind.String);
    const result = {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: stringIndex
        ? typeToSchema(stringIndex, location, depth + 1, nextStack)
        : false,
    };
    return result;
  }

  function collectErrorCodes(root) {
    const found = new Map();
    const visited = new Set();

    function add(status, code) {
      if (!found.has(status)) found.set(status, new Set());
      found.get(status).add(code);
    }

    function visitDeclaration(node) {
      const key = `${node.getSourceFile().fileName}:${node.pos}:${node.end}`;
      if (visited.has(key)) return;
      visited.add(key);
      ts.forEachChild(node, visitNode);
    }

    function visitNode(node) {
      if (ts.isCallExpression(node)) {
        const calledName = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : undefined;
        const status =
          calledName && Object.hasOwn(ERROR_HELPERS, calledName)
            ? ERROR_HELPERS[calledName]
            : undefined;
        const firstArgument = node.arguments[0];
        if (status && firstArgument && ts.isStringLiteralLike(firstArgument)) {
          add(status, firstArgument.text);
        }

        const declaration = checker.getResolvedSignature(node)?.declaration;
        if (
          declaration &&
          /[\\/]src[\\/]/.test(declaration.getSourceFile().fileName) &&
          !declaration.getSourceFile().isDeclarationFile
        ) {
          visitDeclaration(declaration);
        }
      }
      ts.forEachChild(node, visitNode);
    }

    visitDeclaration(root);
    return Object.fromEntries(
      [...found.entries()]
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([status, codes]) => [status, [...codes].sort()]),
    );
  }

  const controllerOperations = [];

  for (const sourceFile of program
    .getSourceFiles()
    .filter(
      (file) => /[\\/]src[\\/]/.test(file.fileName) && file.fileName.endsWith('.controller.ts'),
    )) {
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isClassDeclaration(node) || !node.name || !isOpenApiController(node)) return;
      for (const member of node.members) {
        if (
          !ts.isMethodDeclaration(member) ||
          !ts.isIdentifier(member.name) ||
          !isHttpMethod(member)
        )
          continue;
        const signature = checker.getSignatureFromDeclaration(member);
        if (!signature) continue;
        const operationId = `${node.name.text}_${member.name.text}`;
        const isServerSentEvents = decoratorsOf(member).some(
          (decorator) => decoratorName(decorator) === 'Sse',
        );
        const responseSchema = isServerSentEvents
          ? {
              type: 'string',
              description: 'Secuencia de eventos Server-Sent Events emitida por el runtime.',
            }
          : typeToSchema(checker.getReturnTypeOfSignature(signature), member);
        controllerOperations.push({
          operationId,
          responseSchema,
          collectedErrorCodes: collectErrorCodes(member),
        });
      }
    });
  }

  for (const { operationId, responseSchema, collectedErrorCodes } of controllerOperations) {
    if (!RESPONSE_SCHEMA_EXCLUSIONS.has(operationId)) {
      schemas[`${operationId}Response`] = responseSchema;
    }
    errorCodes[operationId] = collectedErrorCodes;
  }

  if (unresolvedTypes.size)
    throw new Error('Untyped response fields:\n' + [...unresolvedTypes].join('\n'));

  function assertResolved(value, label) {
    if (!value || typeof value !== 'object') return;
    if (isNeverSchema(value) || isNullOnlySchema(value))
      throw new Error(
        label + ': declare the type of empty arrays or null-only response properties.',
      );
    for (const [key, nested] of Object.entries(value)) assertResolved(nested, label + '.' + key);
  }
  for (const [name, schema] of Object.entries(schemas)) assertResolved(schema, name);
  return { schemas, errorCodes };
}

async function writeGeneratedSchemas() {
  const prettier = require('prettier');
  const configFile = ts.readConfigFile(path.join(ROOT, 'tsconfig.build.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, incremental: false });
  // The previous generated artifact is replaced below and checked by the subsequent Nest build.
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter(
      (diagnostic) =>
        !diagnostic.file?.fileName.replaceAll('\\', '/').endsWith('/openapi.response-schemas.ts'),
    );
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => ROOT,
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      }),
    );
  const { schemas, errorCodes } = generateResponseSchemas(program);
  const target = path.join(
    ROOT,
    'src',
    'shared',
    'presentation',
    'openapi',
    'openapi.response-schemas.ts',
  );
  const output =
    `/* Generated by scripts/generate-openapi-response-schemas.cjs. */\n` +
    `import { OpenAPIObject } from '@nestjs/swagger';\n\n` +
    `type SchemasObject = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>;\n` +
    `type SchemaObject = Exclude<SchemasObject[string], { $ref: string }>;\n\n` +
    `export const OPENAPI_RESPONSE_SCHEMAS: Record<string, SchemaObject> = ${JSON.stringify(schemas, null, 2)};\n\n` +
    `export const OPENAPI_ERROR_CODES: Record<string, Record<string, string[]>> = ${JSON.stringify(errorCodes, null, 2)};\n`;
  const prettierConfig = (await prettier.resolveConfig(target)) ?? {};
  const formatted = await prettier.format(output, { ...prettierConfig, filepath: target });

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined;
    if (current?.replaceAll('\r\n', '\n') !== formatted.replaceAll('\r\n', '\n')) {
      process.stderr.write(
        `OpenAPI response schemas are out of date. Run \"pnpm docs:build\" and commit ${target}.\n`,
      );
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`Verified ${Object.keys(schemas).length} response schemas in ${target}\n`);
    return;
  }

  fs.writeFileSync(target, formatted, 'utf8');
  process.stdout.write(`Generated ${Object.keys(schemas).length} response schemas in ${target}\n`);
}

module.exports = { generateResponseSchemas };
if (require.main === module)
  writeGeneratedSchemas().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
