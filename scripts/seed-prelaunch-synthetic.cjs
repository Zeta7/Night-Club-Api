const { PrismaPg } = require('@prisma/adapter-pg');
const {
  LaunchMarketStatus,
  PreLaunchLeadStatus,
  PreLaunchPartnerStatus,
  PrismaClient,
} = require('@prisma/client');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

assertDevelopment();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurado.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const dataRoot = join(__dirname, '..', '..', 'Night-Club-Mobile', 'assets', 'data');
const demoFile = join(__dirname, '..', 'prisma', 'seeds', 'prelaunch-demo.json');
const DEMO_PREFIX = 'prelaunch-demo-v1:';
const baseDate = new Date('2026-08-01T18:00:00.000Z');
const firstNames = [
  'Alessia', 'Alejandro', 'Andrea', 'Andrés', 'Bruno', 'Camila', 'Daniela', 'Diego',
  'Fabiana', 'Gabriel', 'Isabella', 'Joaquín', 'Luciana', 'Mariana', 'Mateo', 'Micaela',
  'Nicolás', 'Paola', 'Renata', 'Rodrigo', 'Sebastián', 'Sofía', 'Thiago', 'Valentina',
  'Valeria', 'Ximena', 'Adrián', 'Carla', 'Franco', 'Jimena', 'Mauricio', 'Nicole',
];
const surnames = [
  'Alarcón', 'Cabrera', 'Campos', 'Cárdenas', 'Castro', 'Chávez', 'Condori', 'Delgado',
  'Espinoza', 'Fernández', 'Flores', 'García', 'Huamán', 'León', 'Mendoza', 'Navarro',
  'Núñez', 'Palacios', 'Paredes', 'Pérez', 'Quintana', 'Reyes', 'Ríos', 'Rojas',
  'Salazar', 'Silva', 'Soto', 'Torres', 'Valdez', 'Vargas', 'Vega', 'Zambrano',
];
const interestSets = [
  ['discotecas', 'eventos'],
  ['restobares', 'beneficios'],
  ['karaokes', 'eventos'],
  ['discotecas', 'restobares'],
  ['eventos', 'beneficios'],
];
const marketDefaults = {
  lima: { name: 'Lima', goal: 3000, order: 1 },
  'la-libertad': { name: 'La Libertad', goal: 1000, order: 2 },
  arequipa: { name: 'Arequipa', goal: 1500, order: 3 },
  'san-martin': { name: 'San Martín', goal: 500, order: 4 },
};

async function main() {
  const locations = loadLocations();
  const demo = JSON.parse(readFileSync(demoFile, 'utf8'));
  validateDemo(demo);

  const markets = new Map();
  for (const marketSpec of demo.markets) {
    const defaults = marketDefaults[marketSpec.slug];
    const market = await prisma.launchMarket.upsert({
      where: { slug: marketSpec.slug },
      create: {
        name: defaults.name,
        slug: marketSpec.slug,
        goal: defaults.goal,
        publicOrder: defaults.order,
        isPublic: true,
        status: LaunchMarketStatus.COLLECTING_DEMAND,
      },
      update: { isPublic: true },
    });
    markets.set(marketSpec.slug, market);

    const department = findDepartment(locations, marketSpec.locations[0].department);
    const mappingKey = `${department.id}:*:*`;
    await prisma.launchMarketUbigeo.upsert({
      where: { mappingKey },
      create: { marketId: market.id, mappingKey, departmentId: department.id },
      update: { marketId: market.id, provinceId: null, districtId: null, ubigeoCode: null },
    });
  }

  const partners = new Map();
  for (const [index, partnerSpec] of demo.partners.entries()) {
    const market = markets.get(partnerSpec.marketSlug);
    if (!market) throw new Error(`Mercado inexistente para el aliado demo ${partnerSpec.key}.`);
    const syntheticKey = `${DEMO_PREFIX}partner:${partnerSpec.key}`;
    const partner = await prisma.preLaunchPartner.upsert({
      where: { syntheticKey },
      create: {
        isSynthetic: true,
        syntheticKey,
        marketId: market.id,
        slug: `demo-${partnerSpec.key}`,
        name: partnerSpec.name,
        category: partnerSpec.category,
        districtName: partnerSpec.district,
        imageUrl: partnerSpec.image,
        logoUrl: './assets/icono-beerry.png',
        benefitCount: partnerSpec.benefits,
        status: PreLaunchPartnerStatus.ACTIVE,
        isPublic: true,
        publicOrder: index + 1,
      },
      update: {
        isSynthetic: true,
        marketId: market.id,
        name: partnerSpec.name,
        category: partnerSpec.category,
        districtName: partnerSpec.district,
        imageUrl: partnerSpec.image,
        logoUrl: './assets/icono-beerry.png',
        benefitCount: partnerSpec.benefits,
        status: PreLaunchPartnerStatus.ACTIVE,
        isPublic: true,
        publicOrder: index + 1,
      },
    });
    const marketPartners = partners.get(partnerSpec.marketSlug) || [];
    marketPartners.push(partner);
    partners.set(partnerSpec.marketSlug, marketPartners);
  }

  const rows = [];
  let globalIndex = 0;
  for (const marketSpec of demo.markets) {
    const market = markets.get(marketSpec.slug);
    const availablePartners = partners.get(marketSpec.slug) || [];
    for (let index = 0; index < marketSpec.count; index += 1) {
      const location = resolveLocation(locations, marketSpec.locations[index % marketSpec.locations.length]);
      const key = `${DEMO_PREFIX}lead:${marketSpec.slug}:${String(index + 1).padStart(4, '0')}`;
      const createdAt = new Date(baseDate.getTime() + globalIndex * 1_500_000);
      const partner = availablePartners.length && index % 5 === 0
        ? availablePartners[index % availablePartners.length]
        : null;
      rows.push({
        isSynthetic: true,
        syntheticKey: key,
        name: `${firstNames[globalIndex % firstNames.length]} ${surnames[Math.floor(globalIndex / firstNames.length) % surnames.length]}`,
        email: `demo-${marketSpec.slug}-${String(index + 1).padStart(4, '0')}@seed.beerry.invalid`,
        phoneCountryCode: '+51',
        phoneNumber: String(920000000 + globalIndex),
        phoneE164: `+51${920000000 + globalIndex}`,
        phoneVerifiedAt: createdAt,
        ...location,
        launchMarketId: market.id,
        interests: interestSets[globalIndex % interestSets.length],
        isAdultDeclared: true,
        privacyAcceptedAt: createdAt,
        privacyPolicyVersion: 'development-demo-v1',
        marketingConsent: false,
        referralCode: `DM${String(globalIndex + 1).padStart(7, '0')}`,
        sourceBusinessId: partner?.id || null,
        utmSource: 'development-demo',
        utmCampaign: 'prelaunch-card-preview',
        landingOrigin: 'seed:development-demo-v1',
        status: PreLaunchLeadStatus.VERIFIED,
        accessTokenHash: createHash('sha256').update(key).digest('hex'),
        createdAt,
        updatedAt: createdAt,
      });
      globalIndex += 1;
    }
  }

  await prisma.preLaunchLead.deleteMany({
    where: {
      isSynthetic: true,
      OR: [
        { syntheticKey: { startsWith: 'prelaunch-user-v2:' } },
        { syntheticKey: { startsWith: 'prelaunch-seed-v1:' } },
      ],
    },
  });
  const before = await prisma.preLaunchLead.count({
    where: { isSynthetic: true, syntheticKey: { startsWith: `${DEMO_PREFIX}lead:` } },
  });
  const created = await prisma.preLaunchLead.createMany({ data: rows, skipDuplicates: true });
  const distribution = await prisma.preLaunchLead.groupBy({
    by: ['departmentName'],
    where: {
      isSynthetic: true,
      syntheticKey: { startsWith: `${DEMO_PREFIX}lead:` },
      status: PreLaunchLeadStatus.VERIFIED,
    },
    _count: { _all: true },
    orderBy: { _count: { departmentName: 'desc' } },
  });

  console.log('\nDemo de prelanzamiento cargada (solo desarrollo).');
  console.log(`Usuarios demo esperados: ${rows.length}`);
  console.log(`Usuarios demo que ya existían: ${before}`);
  console.log(`Usuarios demo insertados ahora: ${created.count}`);
  console.log(`Negocios demo sincronizados: ${demo.partners.length}`);
  console.table(distribution.map((item) => ({
    departamento: item.departmentName,
    usuarios: item._count._all,
  })));
  console.log('Para retirar únicamente estos datos ejecuta: npm run prelaunch:demo:clear');
}

function assertDevelopment() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Este script solo puede ejecutarse con NODE_ENV=development.');
  }
}

function validateDemo(demo) {
  if (!Array.isArray(demo.markets) || !demo.markets.length) throw new Error('No hay mercados demo configurados.');
  if (!Array.isArray(demo.partners)) throw new Error('La lista de negocios demo es inválida.');
  for (const market of demo.markets) {
    if (!marketDefaults[market.slug] || !Number.isInteger(market.count) || market.count < 1 || !Array.isArray(market.locations) || !market.locations.length) {
      throw new Error(`Configuración demo inválida para ${market.slug || 'mercado sin slug'}.`);
    }
  }
}

function loadLocations() {
  const departments = JSON.parse(readFileSync(join(dataRoot, 'peru_departments.json'), 'utf8')).ubigeo_departamentos
    .map((item) => ({ id: item.id, name: title(item.departamento), ubigeo: item.ubigeo }));
  const provinces = JSON.parse(readFileSync(join(dataRoot, 'peru_provinces.json'), 'utf8')).ubigeo_provincias
    .map((item) => ({ id: item.id, name: title(item.provincia), ubigeo: item.ubigeo, departmentId: item.departamento_id }));
  const districts = JSON.parse(readFileSync(join(dataRoot, 'peru_districts.json'), 'utf8')).ubigeo_distritos
    .map((item) => ({ id: item.id, name: title(item.distrito), ubigeo: item.ubigeo, provinceId: item.provincia_id, departmentId: item.departamento_id }));
  return { departments, provinces, districts };
}

function findDepartment(locations, name) {
  const department = locations.departments.find((item) => normalize(item.name) === normalize(name));
  if (!department) throw new Error(`Departamento demo inválido: ${name}.`);
  return department;
}

function resolveLocation(locations, input) {
  const department = findDepartment(locations, input.department);
  const province = locations.provinces.find((item) => item.departmentId === department.id && normalize(item.name) === normalize(input.province));
  const district = locations.districts.find((item) => item.provinceId === province?.id && normalize(item.name) === normalize(input.district));
  if (!province || !district) throw new Error(`Ubicación demo inválida: ${input.department} / ${input.province} / ${input.district}.`);
  return {
    departmentId: department.id,
    provinceId: province.id,
    districtId: district.id,
    departmentName: department.name,
    provinceName: province.name,
    districtName: district.name,
    ubigeoCode: district.ubigeo,
  };
}

function title(value) {
  return value.toLocaleLowerCase('es-PE').replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('es-PE'));
}

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
