const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, UserRole, UserStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurado.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const apiBase = process.env.PRELAUNCH_SMOKE_API_BASE || 'http://127.0.0.1:3000/api/v1';
const suffix = `${Date.now()}`.slice(-8);
const phoneNumber = `98${suffix.slice(-7)}`;
const password = `Smoke-${suffix}-Beerry!`;
let adminId;
let marketId;
let partnerId;
let publishedPartnerId;
let applicationId;

async function request(path, options = {}, token) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: { phoneCountryCode: '+51', phoneNumber, phoneVerifiedAt: new Date(), email: `prelaunch-smoke-${suffix}@beerry.invalid`, passwordHash, fullName: 'Prelaunch Smoke Admin', role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
  });
  adminId = admin.id;

  const unauthorized = await request('/platform/prelaunch/dashboard');
  assert(unauthorized.response.status === 401, `El dashboard sin token respondió ${unauthorized.response.status}, se esperaba 401.`);

  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ phoneCountryCode: '+51', phoneNumber, password }) });
  assert(login.response.ok && login.body.user?.role === 'SUPER_ADMIN', 'El login del superadmin temporal falló.');
  const token = login.body.auth.accessToken;

  const [dashboardResult, syntheticLeadsResult, realLeadsResult, marketsResult, partnersResult, applicationsResult, publicResult] = await Promise.all([
    request('/platform/prelaunch/dashboard', {}, token),
    request('/platform/prelaunch/leads?source=SYNTHETIC&pageSize=100', {}, token),
    request('/platform/prelaunch/leads?source=REAL&pageSize=100', {}, token),
    request('/platform/prelaunch/markets', {}, token),
    request('/platform/prelaunch/partners', {}, token),
    request('/platform/prelaunch/business-applications', {}, token),
    request('/prelaunch/overview'),
  ]);
  [dashboardResult, syntheticLeadsResult, realLeadsResult, marketsResult, partnersResult, applicationsResult, publicResult].forEach(({ response }) => assert(response.ok, `Endpoint administrativo falló con ${response.status}.`));

  const funnel = dashboardResult.body.funnel;
  assert(funnel.verified === funnel.realVerified + funnel.syntheticVerified, 'El desglose total/real/prueba no cuadra.');
  assert(funnel.syntheticVerified > 0, 'El dashboard no está viendo los registros ficticios sembrados.');
  assert(syntheticLeadsResult.body.items.every((item) => item.isSynthetic), 'El filtro SYNTHETIC devolvió registros reales.');
  assert(realLeadsResult.body.items.every((item) => !item.isSynthetic), 'El filtro REAL devolvió registros ficticios.');
  const expectedPublicTotal = process.env.NODE_ENV === 'development' ? funnel.verified : funnel.realVerified;
  assert(publicResult.body.verifiedTotal === expectedPublicTotal, 'El contador público no coincide con la política de datos demo del entorno.');
  assert(Array.isArray(marketsResult.body) && Array.isArray(partnersResult.body) && Array.isArray(applicationsResult.body), 'Las colecciones administrativas no tienen el formato esperado.');

  const missingDate = await request('/platform/prelaunch/markets', { method: 'POST', body: JSON.stringify({ name: 'Smoke sin fecha', slug: `smoke-no-date-${suffix}`, goal: 10, status: 'LAUNCH_SCHEDULED', publicOrder: 999, isPublic: false, benefitsPrepared: 0, eventsPrepared: 0, ubigeos: [] }) }, token);
  assert(missingDate.response.status === 400, 'Un lanzamiento programado sin fecha debió rechazarse.');

  const market = await request('/platform/prelaunch/markets', { method: 'POST', body: JSON.stringify({ name: 'Mercado Smoke', slug: `mercado-smoke-${suffix}`, goal: 50, status: 'COLLECTING_DEMAND', publicOrder: 998, isPublic: false, benefitsPrepared: 2, eventsPrepared: 1, ubigeos: [] }) }, token);
  assert(market.response.status === 201, `No se pudo crear el mercado de prueba (${market.response.status}).`);
  marketId = market.body.id;
  const updatedMarket = await request(`/platform/prelaunch/markets/${marketId}`, { method: 'PUT', body: JSON.stringify({ name: 'Mercado Smoke Editado', slug: `mercado-smoke-${suffix}`, goal: 75, status: 'ONBOARDING_PARTNERS', publicOrder: 998, isPublic: false, benefitsPrepared: 3, eventsPrepared: 2, ubigeos: [] }) }, token);
  assert(updatedMarket.response.ok && updatedMarket.body.goal === 75, 'No se pudo editar el mercado de prueba.');

  const partner = await request('/platform/prelaunch/partners', { method: 'POST', body: JSON.stringify({ marketId, slug: `aliado-smoke-${suffix}`, name: 'Aliado Smoke', category: 'Restobar', districtName: 'Lima', benefitCount: 1, status: 'APPROVED', isPublic: false, publicOrder: 998 }) }, token);
  assert(partner.response.status === 201, `No se pudo crear el aliado de prueba (${partner.response.status}).`);
  partnerId = partner.body.id;
  const updatedPartner = await request(`/platform/prelaunch/partners/${partnerId}`, { method: 'PUT', body: JSON.stringify({ marketId, slug: `aliado-smoke-${suffix}`, name: 'Aliado Smoke Editado', category: 'Restobar', districtName: 'Lima', benefitCount: 2, status: 'PARTNER', isPublic: false, publicOrder: 998 }) }, token);
  assert(updatedPartner.response.ok && updatedPartner.body.benefitCount === 2, 'No se pudo editar el aliado de prueba.');

  const application = await prisma.businessPreLaunchApplication.create({ data: { businessName: 'Negocio Smoke', type: 'restobar', departmentId: 15, provinceId: 128, districtId: 1252, departmentName: 'Lima', provinceName: 'Lima', districtName: 'Lima', ubigeoCode: '150101', address: 'Dirección temporal', contactName: 'Contacto Smoke', phoneE164: `+519${suffix}`, email: `business-smoke-${suffix}@beerry.invalid` } });
  applicationId = application.id;
  const published = await request(`/platform/prelaunch/business-applications/${applicationId}/publish`, { method: 'POST', body: JSON.stringify({ marketId, publicName: 'Negocio Smoke', benefitCount: 1, isPublic: true, publicOrder: 1 }) }, token);
  assert(published.response.ok && published.body.partner?.isPublic, 'No se pudo publicar la solicitud comercial como aliado.');
  publishedPartnerId = published.body.partner.id;
  const detail = await request(`/platform/prelaunch/markets/${marketId}/detail`, {}, token);
  assert(detail.response.ok && detail.body.applications?.some((item) => item.id === applicationId), 'El detalle departamental no incluyó la solicitud publicada.');
  assert(detail.body.partners?.some((item) => item.id === publishedPartnerId), 'El detalle departamental no incluyó el aliado publicado.');

  console.log(JSON.stringify({ ok: true, verified: funnel.verified, real: funnel.realVerified, synthetic: funnel.syntheticVerified, syntheticFilterTotal: syntheticLeadsResult.body.pagination.total, realFilterTotal: realLeadsResult.body.pagination.total, markets: marketsResult.body.length, partners: partnersResult.body.length, applications: applicationsResult.body.length, marketDetail: true, businessPublishing: true }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (publishedPartnerId) await prisma.preLaunchPartner.deleteMany({ where: { id: publishedPartnerId } });
  if (partnerId) await prisma.preLaunchPartner.deleteMany({ where: { id: partnerId } });
  if (applicationId) await prisma.businessPreLaunchApplication.deleteMany({ where: { id: applicationId } });
  if (marketId) await prisma.launchMarket.deleteMany({ where: { id: marketId } });
  if (adminId) {
    await prisma.refreshToken.deleteMany({ where: { userId: adminId } });
    await prisma.user.deleteMany({ where: { id: adminId } });
  }
  await prisma.$disconnect();
});
