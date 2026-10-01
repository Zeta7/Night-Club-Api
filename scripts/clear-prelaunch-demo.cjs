const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Este script solo puede ejecutarse con NODE_ENV=development.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurado.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const DEMO_PREFIX = 'prelaunch-demo-v1:';

async function main() {
  const result = await prisma.$transaction(async (transaction) => {
    const leads = await transaction.preLaunchLead.deleteMany({
      where: { isSynthetic: true, syntheticKey: { startsWith: `${DEMO_PREFIX}lead:` } },
    });
    const partners = await transaction.preLaunchPartner.deleteMany({
      where: { isSynthetic: true, syntheticKey: { startsWith: `${DEMO_PREFIX}partner:` } },
    });
    return { leads: leads.count, partners: partners.count };
  });

  console.log('Datos demo retirados. Los registros reales no fueron modificados.');
  console.table([{ usuariosEliminados: result.leads, negociosEliminados: result.partners }]);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
