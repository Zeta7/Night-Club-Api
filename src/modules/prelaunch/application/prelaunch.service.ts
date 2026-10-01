import { ConfigService } from '@nestjs/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  BusinessPreLaunchApplicationStatus,
  LaunchMarketStatus,
  PreLaunchEventType,
  PreLaunchLeadStatus,
  PreLaunchPartnerStatus,
  Prisma,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, conflict, notFound, serviceUnavailable } from '../../../shared/presentation/api-exception';
import { VerificationCodeService } from '../../identity/application/verification-code.service';
import { NotificationService } from '../../notification/application/notification.service';
import { UbigeoService } from '../infrastructure/ubigeo.service';
import {
  AdminPreLaunchQueryDto,
  CreateBusinessPreLaunchApplicationDto,
  PublishBusinessPreLaunchApplicationDto,
  StartPreLaunchRegistrationDto,
  TrackPreLaunchEventDto,
  UpsertLaunchMarketDto,
  UpsertPreLaunchPartnerDto,
} from '../presentation/dto/prelaunch.dto';

type ClientContext = { ip?: string | null; userAgent?: string | null };

const PUBLIC_EVENTS = new Set<PreLaunchEventType>([
  PreLaunchEventType.PAGE_VIEW,
  PreLaunchEventType.EARLY_ACCESS_CLICKED,
  PreLaunchEventType.REGISTRATION_STARTED,
  PreLaunchEventType.REFERRAL_SHARED,
  PreLaunchEventType.BUSINESS_FORM_STARTED,
  PreLaunchEventType.CITY_VIEWED,
  PreLaunchEventType.PARTNER_CLICKED,
]);

const PRELAUNCH_PRIVACY_POLICY_VERSION = '2026-09-25';
const PRELAUNCH_OTP_RESEND_SECONDS = 60;
const PRELAUNCH_OTP_REQUEST_LIMIT = 3;
const PRELAUNCH_OTP_MAX_ATTEMPTS = 5;
const PRELAUNCH_OTP_EXPIRATION_MINUTES = 10;
const PRELAUNCH_DEFAULT_CITY_GOAL = 500;
const PRELAUNCH_REGISTRATION_IP_LIMIT = 8;

@Injectable()
export class PreLaunchService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly verificationCodes: VerificationCodeService,
    private readonly notifications: NotificationService,
    private readonly ubigeo: UbigeoService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  locations() {
    return this.ubigeo.list();
  }

  async overview() {
    const verifiedStatuses = [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED];
    const showDemoData = this.config.get<string>('NODE_ENV') === 'development';
    const publicLeadFilter: Prisma.PreLaunchLeadWhereInput = {
      status: { in: verifiedStatuses },
      ...(showDemoData ? {} : { isSynthetic: false }),
    };
    const publicPartnerFilter: Prisma.PreLaunchPartnerWhereInput = {
      isPublic: true,
      status: { in: [PreLaunchPartnerStatus.PARTNER, PreLaunchPartnerStatus.ACTIVE] },
      ...(showDemoData ? {} : { isSynthetic: false }),
    };
    const [verifiedTotal, markets, cityGroups] = await Promise.all([
      this.prisma.preLaunchLead.count({ where: publicLeadFilter }),
      this.prisma.launchMarket.findMany({
        include: {
          _count: { select: { leads: { where: publicLeadFilter } } },
          partners: { where: publicPartnerFilter, orderBy: { publicOrder: 'asc' } },
        },
        orderBy: [{ publicOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.preLaunchLead.groupBy({
        by: ['launchMarketId', 'departmentName'],
        where: publicLeadFilter,
        _count: { _all: true },
        orderBy: { _count: { departmentName: 'desc' } },
        take: 24,
      }),
    ]);

    const marketById = new Map(markets.map((market) => [market.id, market]));
    const defaultCityGoal = PRELAUNCH_DEFAULT_CITY_GOAL;

    return {
      verifiedTotal,
      cities: cityGroups.map((city) => {
        const market = marketById.get(city.launchMarketId);
        const goal = market?.isPublic ? market.goal : defaultCityGoal;
        const verifiedCount = city._count._all;
        return {
          id: `${city.departmentName}`,
          name: city.departmentName,
          departmentName: city.departmentName,
          marketSlug: market?.slug ?? null,
          goal,
          status: market?.isPublic ? market.status : LaunchMarketStatus.COLLECTING_DEMAND,
          launchAt: market?.isPublic && market.status === LaunchMarketStatus.LAUNCH_SCHEDULED ? market.launchAt : null,
          verifiedCount,
          remaining: Math.max(0, goal - verifiedCount),
          progress: Math.min(100, Math.round((verifiedCount / goal) * 100)),
        };
      }),
      markets: markets.filter((market) => market.isPublic).map((market) => ({
        id: market.id,
        name: market.name,
        slug: market.slug,
        goal: market.goal,
        status: market.status,
        launchAt: market.status === LaunchMarketStatus.LAUNCH_SCHEDULED ? market.launchAt : null,
        verifiedCount: market._count.leads,
        remaining: Math.max(0, market.goal - market._count.leads),
        progress: Math.min(100, Math.round((market._count.leads / market.goal) * 100)),
        partnerCount: market.partners.length,
        benefitCount: market.benefitsPrepared || market.partners.reduce((sum, partner) => sum + partner.benefitCount, 0),
        partners: market.partners.map((partner) => ({
          id: partner.id,
          slug: partner.slug,
          name: partner.name,
          category: partner.category,
          districtName: partner.districtName,
          logoUrl: partner.logoUrl,
          imageUrl: partner.imageUrl,
          benefitCount: partner.benefitCount,
        })),
      })),
    };
  }

  async startRegistration(input: StartPreLaunchRegistrationDto, client: ClientContext) {
    const ipHash = this.hashIp(client.ip);
    await this.assertRateLimit({ type: PreLaunchEventType.REGISTRATION_COMPLETED, ipHash, maximum: PRELAUNCH_REGISTRATION_IP_LIMIT, minutes: 60 });
    await this.verifyTurnstile(input.turnstileToken, client.ip);
    if (!input.isAdultDeclared) throw badRequest('ADULT_DECLARATION_REQUIRED', 'Debes confirmar que eres mayor de 18 años.');
    this.assertPrivacyAcceptance(input.privacyAccepted, input.privacyPolicyVersion);

    const location = this.ubigeo.resolve(input);
    const phoneNumber = input.phone.replace(/\D/g, '');
    const phoneE164 = `+51${phoneNumber}`;
    const email = input.email.trim().toLowerCase();
    const market = await this.resolveMarket(location);
    const existingPhone = await this.prisma.preLaunchLead.findUnique({ where: { phoneE164 } });
    if (existingPhone?.phoneVerifiedAt) {
      if (existingPhone.status === PreLaunchLeadStatus.BLOCKED) {
        throw badRequest('PRELAUNCH_LEAD_BLOCKED', 'Este registro requiere revisión.');
      }
      const rawRecoveryToken = randomBytes(32).toString('base64url');
      await this.prisma.preLaunchLead.update({
        where: { id: existingPhone.id },
        data: { recoveryTokenHash: this.hash(rawRecoveryToken) },
      });
      await this.sendOtp(existingPhone, client, input.turnstileToken, false);
      return {
        message: 'Encontramos tu registro. Te enviamos un código para recuperar tu acceso.',
        accessToken: rawRecoveryToken,
        maskedPhone: `*** *** ${phoneNumber.slice(-3)}`,
        expiresInSeconds: PRELAUNCH_OTP_EXPIRATION_MINUTES * 60,
        existingRegistration: true,
      };
    }
    const existingEmail = await this.prisma.preLaunchLead.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== existingPhone?.id) {
      throw conflict('EMAIL_ALREADY_REGISTERED', 'Este correo ya pertenece a otro registro.');
    }
    const sourceBusiness = input.sourceBusinessSlug
      ? await this.prisma.preLaunchPartner.findUnique({ where: { slug: input.sourceBusinessSlug.toLowerCase() } })
      : null;
    const referredBy = input.referralCode
      ? await this.prisma.preLaunchLead.findFirst({ where: { referralCode: input.referralCode.toUpperCase(), status: { in: [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED] } } })
      : null;
    const rawAccessToken = randomBytes(32).toString('base64url');
    const accessTokenHash = this.hash(rawAccessToken);
    const data = {
      name: clean(input.name), email, phoneCountryCode: '+51', phoneNumber, phoneE164,
      ...location, launchMarketId: market.id,
      interests: [...new Set(input.interests.map((item) => item.trim().toLowerCase()))],
      isAdultDeclared: true, privacyAcceptedAt: new Date(), privacyPolicyVersion: clean(input.privacyPolicyVersion),
      marketingConsent: input.marketingConsent, marketingConsentAt: input.marketingConsent ? new Date() : null,
      referredById: referredBy?.id ?? existingPhone?.referredById ?? null,
      sourceBusinessId: sourceBusiness?.id ?? existingPhone?.sourceBusinessId ?? null,
      utmSource: optional(input.utmSource), utmMedium: optional(input.utmMedium), utmCampaign: optional(input.utmCampaign),
      influencerCode: optional(input.influencerCode), landingOrigin: optional(input.landingOrigin),
      status: PreLaunchLeadStatus.PENDING_OTP, accessTokenHash,
    } satisfies Prisma.PreLaunchLeadUncheckedUpdateInput;

    const lead = existingPhone
      ? await this.prisma.preLaunchLead.update({ where: { id: existingPhone.id }, data })
      : await this.prisma.preLaunchLead.create({ data: { ...data, referralCode: await this.uniqueReferralCode() } as Prisma.PreLaunchLeadUncheckedCreateInput });

    await this.recordEvent(PreLaunchEventType.REGISTRATION_COMPLETED, lead, input, client);
    await this.sendOtp(lead, client, input.turnstileToken, false);
    return { message: 'Te enviamos un código de verificación.', accessToken: rawAccessToken, maskedPhone: `*** *** ${phoneNumber.slice(-3)}`, expiresInSeconds: PRELAUNCH_OTP_EXPIRATION_MINUTES * 60, existingRegistration: false };
  }

  async resendOtp(accessToken: string, turnstileToken: string | undefined, client: ClientContext) {
    const lead = await this.leadByAccessToken(accessToken);
    if (lead.phoneVerifiedAt && !lead.isRecoveryToken) return { message: 'Tu teléfono ya está verificado.' };
    await this.sendOtp(lead, client, turnstileToken, true);
    return { message: 'Te enviamos un nuevo código.', expiresInSeconds: PRELAUNCH_OTP_EXPIRATION_MINUTES * 60 };
  }

  async verifyOtp(accessToken: string, code: string, client: ClientContext) {
    const lead = await this.leadByAccessToken(accessToken);
    if (lead.status === PreLaunchLeadStatus.BLOCKED) throw badRequest('PRELAUNCH_LEAD_BLOCKED', 'Este registro requiere revisión.');
    const returningUser = lead.isRecoveryToken;
    if (returningUser || !lead.phoneVerifiedAt) {
      const otp = await this.prisma.preLaunchOtp.findFirst({ where: { leadId: lead.id, consumedAt: null }, orderBy: { createdAt: 'desc' } });
      if (!otp) throw badRequest('OTP_NOT_FOUND', 'Solicita un nuevo código de verificación.');
      if (otp.expiresAt.getTime() < Date.now()) throw badRequest('OTP_EXPIRED', 'El código venció. Solicita uno nuevo.');
      const maxAttempts = PRELAUNCH_OTP_MAX_ATTEMPTS;
      if (otp.attempts >= maxAttempts) throw badRequest('OTP_ATTEMPTS_EXCEEDED', 'Superaste el número máximo de intentos.');
      const valid = await this.verificationCodes.compare(code, otp.codeHash);
      if (!valid) {
        await this.prisma.preLaunchOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
        throw badRequest('INVALID_OTP', 'El código no es correcto.');
      }
      const now = new Date();
      const leadUpdate = returningUser
        ? { accessTokenHash: this.hash(accessToken), recoveryTokenHash: null }
        : { phoneVerifiedAt: now, status: PreLaunchLeadStatus.VERIFIED };
      await this.prisma.$transaction([
        this.prisma.preLaunchOtp.update({ where: { id: otp.id }, data: { consumedAt: now } }),
        this.prisma.preLaunchLead.update({ where: { id: lead.id }, data: leadUpdate }),
      ]);
      if (!returningUser) {
        await this.recordEvent(PreLaunchEventType.PHONE_VERIFIED, lead, {}, client);
        if (lead.referredById) await this.recordEvent(PreLaunchEventType.REFERRAL_VERIFIED, lead, {}, client);
      }
    }
    return { ...(await this.accessStatus(accessToken)), returningUser };
  }

  async accessStatus(accessToken: string) {
    const lead = await this.leadByAccessToken(accessToken);
    if (lead.isRecoveryToken || !lead.phoneVerifiedAt) return { verified: false, status: lead.status, returningUser: lead.isRecoveryToken };
    const cityWhere = { departmentId: lead.departmentId, provinceId: lead.provinceId, isSynthetic: false };
    const [position, verifiedCount, referralCount, levels] = await Promise.all([
      this.prisma.preLaunchLead.count({ where: { ...cityWhere, phoneVerifiedAt: { not: null, lte: lead.phoneVerifiedAt } } }),
      this.prisma.preLaunchLead.count({ where: { ...cityWhere, status: { in: [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED] } } }),
      this.prisma.preLaunchLead.count({ where: { referredById: lead.id, status: { in: [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED] } } }),
      this.prisma.preLaunchLevel.findMany({ where: { isActive: true }, orderBy: { minimumReferrals: 'desc' } }),
    ]);
    const level = levels.find((item) => referralCount >= item.minimumReferrals) ?? null;
    return {
      verified: true,
      name: lead.name,
      position,
      referralCode: lead.referralCode,
      referralPath: `/unete/${lead.referralCode}`,
      referralCount,
      level: level?.name ?? 'Acceso anticipado',
      registeredAt: (lead.phoneVerifiedAt ?? lead.createdAt).toISOString(),
      returningUser: false,
      location: {
        department: lead.departmentName,
        province: lead.provinceName,
        district: lead.districtName,
      },
      market: {
        id: lead.market.id,
        name: lead.departmentName,
        slug: lead.market.slug,
        goal: lead.market.isPublic ? lead.market.goal : PRELAUNCH_DEFAULT_CITY_GOAL,
        status: lead.market.isPublic ? lead.market.status : LaunchMarketStatus.COLLECTING_DEMAND,
        launchAt: lead.market.isPublic && lead.market.status === LaunchMarketStatus.LAUNCH_SCHEDULED ? lead.market.launchAt : null,
        verifiedCount,
        progress: Math.min(100, Math.round((verifiedCount / (lead.market.isPublic ? lead.market.goal : PRELAUNCH_DEFAULT_CITY_GOAL)) * 100)),
      },
    };
  }

  async createBusinessApplication(input: CreateBusinessPreLaunchApplicationDto, client: ClientContext) {
    const ipHash = this.hashIp(client.ip);
    await this.assertRateLimit({ type: PreLaunchEventType.BUSINESS_FORM_SUBMITTED, ipHash, maximum: 5, minutes: 60 });
    await this.verifyTurnstile(input.turnstileToken, client.ip);
    this.assertPrivacyAcceptance(input.privacyAccepted, input.privacyPolicyVersion);
    const location = this.ubigeo.resolve(input);
    const application = await this.prisma.businessPreLaunchApplication.create({
      data: {
        businessName: clean(input.businessName), type: clean(input.type).toLowerCase(), ...location,
        address: clean(input.address), contactName: clean(input.contactName), phoneE164: `+51${input.phone.replace(/\D/g, '')}`,
        email: input.email.trim().toLowerCase(), socialNetworks: optional(input.socialNetworks), comment: optional(input.comment),
        privacyAcceptedAt: new Date(), privacyPolicyVersion: clean(input.privacyPolicyVersion),
      },
    });
    await this.prisma.preLaunchEvent.create({ data: { type: PreLaunchEventType.BUSINESS_FORM_SUBMITTED, sessionId: optional(input.sessionId), ipHash, userAgent: optional(client.userAgent), metadata: { applicationId: application.id } } });
    return { message: 'Recibimos tu solicitud. El equipo de Beerry se pondrá en contacto contigo.', applicationId: application.id };
  }

  async track(input: TrackPreLaunchEventDto, client: ClientContext) {
    if (!PUBLIC_EVENTS.has(input.type)) throw badRequest('EVENT_NOT_ALLOWED', 'Este evento no puede registrarse desde la web pública.');
    const ipHash = this.hashIp(client.ip);
    await this.assertRateLimit({ type: input.type, ipHash, maximum: 120, minutes: 10 });
    const lead = input.accessToken ? await this.leadByAccessToken(input.accessToken) : null;
    const market = input.marketSlug ? await this.prisma.launchMarket.findUnique({ where: { slug: input.marketSlug } }) : null;
    const partner = input.partnerSlug ? await this.prisma.preLaunchPartner.findUnique({ where: { slug: input.partnerSlug } }) : null;
    await this.prisma.preLaunchEvent.create({ data: { type: input.type, leadId: lead?.id, launchMarketId: market?.id, sourceBusinessId: partner?.id, sessionId: optional(input.sessionId), ipHash, userAgent: optional(client.userAgent), utmSource: optional(input.utmSource), utmMedium: optional(input.utmMedium), utmCampaign: optional(input.utmCampaign), landingOrigin: optional(input.landingOrigin) } });
    return { recorded: true };
  }

  async adminDashboard() {
    const verifiedStatuses = [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED];
    const [visitors, started, submitted, otpSent, verified, syntheticVerified, blocked, converted, applications, markets, syntheticByMarket, interests, acquisitionGroups, districtGroups, partners] = await Promise.all([
      this.prisma.preLaunchEvent.count({ where: { type: PreLaunchEventType.PAGE_VIEW } }),
      this.prisma.preLaunchEvent.count({ where: { type: PreLaunchEventType.REGISTRATION_STARTED } }),
      this.prisma.preLaunchEvent.count({ where: { type: PreLaunchEventType.REGISTRATION_COMPLETED } }),
      this.prisma.preLaunchEvent.count({ where: { type: PreLaunchEventType.OTP_REQUESTED } }),
      this.prisma.preLaunchLead.count({ where: { status: { in: verifiedStatuses } } }),
      this.prisma.preLaunchLead.count({ where: { status: { in: verifiedStatuses }, isSynthetic: true } }),
      this.prisma.preLaunchLead.count({ where: { status: PreLaunchLeadStatus.BLOCKED } }),
      this.prisma.preLaunchLead.count({ where: { status: PreLaunchLeadStatus.CONVERTED } }),
      this.prisma.businessPreLaunchApplication.count(),
      this.prisma.launchMarket.findMany({ include: { _count: { select: { leads: { where: { status: { in: verifiedStatuses } } }, partners: { where: { isPublic: true } } } } }, orderBy: { publicOrder: 'asc' } }),
      this.prisma.preLaunchLead.groupBy({ by: ['launchMarketId'], where: { status: { in: verifiedStatuses }, isSynthetic: true }, _count: { _all: true } }),
      this.prisma.preLaunchLead.findMany({ where: { status: { in: verifiedStatuses } }, select: { interests: true, isSynthetic: true } }),
      this.prisma.preLaunchLead.groupBy({ by: ['utmSource', 'isSynthetic'], where: { status: { in: verifiedStatuses } }, _count: { _all: true } }),
      this.prisma.preLaunchLead.groupBy({ by: ['departmentName', 'provinceName', 'districtName', 'ubigeoCode', 'isSynthetic'], where: { status: { in: verifiedStatuses } }, _count: { _all: true } }),
      this.prisma.preLaunchPartner.findMany({ include: { _count: { select: { sourcedLeads: { where: { status: { in: verifiedStatuses } } } } } }, orderBy: { publicOrder: 'asc' } }),
    ]);
    const interestCounts: Record<string, number> = {};
    const realInterestCounts: Record<string, number> = {};
    const syntheticInterestCounts: Record<string, number> = {};
    interests.forEach((item) => item.interests.forEach((interest) => {
      interestCounts[interest] = (interestCounts[interest] ?? 0) + 1;
      const target = item.isSynthetic ? syntheticInterestCounts : realInterestCounts;
      target[interest] = (target[interest] ?? 0) + 1;
    }));
    const acquisition = new Map<string, { source: string; verified: number; realVerified: number; syntheticVerified: number }>();
    acquisitionGroups.forEach((item) => {
      const source = item.utmSource ?? 'Directo';
      const current = acquisition.get(source) ?? { source, verified: 0, realVerified: 0, syntheticVerified: 0 };
      current.verified += item._count._all;
      if (item.isSynthetic) current.syntheticVerified += item._count._all;
      else current.realVerified += item._count._all;
      acquisition.set(source, current);
    });
    const geography = new Map<string, { department: string; province: string; district: string; ubigeoCode: string; verified: number; realVerified: number; syntheticVerified: number }>();
    districtGroups.forEach((item) => {
      const current = geography.get(item.ubigeoCode) ?? { department: item.departmentName, province: item.provinceName, district: item.districtName, ubigeoCode: item.ubigeoCode, verified: 0, realVerified: 0, syntheticVerified: 0 };
      current.verified += item._count._all;
      if (item.isSynthetic) current.syntheticVerified += item._count._all;
      else current.realVerified += item._count._all;
      geography.set(item.ubigeoCode, current);
    });
    const syntheticMarketCounts = new Map(syntheticByMarket.map((item) => [item.launchMarketId, item._count._all]));
    return {
      funnel: {
        visitors,
        started,
        submitted,
        otpSent,
        verified,
        realVerified: Math.max(0, verified - syntheticVerified),
        syntheticVerified,
        verificationRate: submitted ? Math.round(((verified - syntheticVerified) / submitted) * 1000) / 10 : 0,
        blocked,
        converted,
      },
      applications,
      interests: interestCounts,
      realInterests: realInterestCounts,
      syntheticInterests: syntheticInterestCounts,
      acquisition: [...acquisition.values()].sort((a, b) => b.verified - a.verified).slice(0, 12),
      geography: [...geography.values()].sort((a, b) => b.verified - a.verified).slice(0, 30),
      markets: markets.map((market) => {
        const syntheticCount = syntheticMarketCounts.get(market.id) ?? 0;
        return { ...market, verifiedCount: market._count.leads, realVerifiedCount: Math.max(0, market._count.leads - syntheticCount), syntheticCount, partnerCount: market._count.partners, readiness: this.readiness(market._count.leads, market.goal, market._count.partners, market.benefitsPrepared, market.eventsPrepared) };
      }),
      partners: partners.map((partner) => ({ ...partner, verifiedLeads: partner._count.sourcedLeads })),
    };
  }

  async adminLeads(query: AdminPreLaunchQueryDto) {
    const where: Prisma.PreLaunchLeadWhereInput = {
      ...(query.marketId ? { launchMarketId: query.marketId } : {}),
      ...(query.ubigeoCode ? { ubigeoCode: query.ubigeoCode } : {}),
      ...(query.source ? { isSynthetic: query.source === 'SYNTHETIC' } : {}),
      ...(query.query ? { OR: [
        { name: { contains: query.query, mode: 'insensitive' } },
        { email: { contains: query.query, mode: 'insensitive' } },
        { phoneE164: { contains: query.query } },
        { referralCode: { contains: query.query.toUpperCase() } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.preLaunchLead.findMany({ where, include: { market: { select: { id: true, name: true } }, referredBy: { select: { id: true, name: true, referralCode: true } }, _count: { select: { referrals: { where: { status: { in: [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED] } } } } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.preLaunchLead.count({ where }),
    ]);
    return { items: items.map(({ accessTokenHash: _secret, ...item }) => item), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
  }

  async adminMarkets() {
    const verifiedStatuses = [PreLaunchLeadStatus.VERIFIED, PreLaunchLeadStatus.CONVERTED];
    const [markets, syntheticByMarket] = await Promise.all([
      this.prisma.launchMarket.findMany({ include: { ubigeos: true, _count: { select: { leads: { where: { status: { in: verifiedStatuses } } }, partners: true } } }, orderBy: { publicOrder: 'asc' } }),
      this.prisma.preLaunchLead.groupBy({ by: ['launchMarketId'], where: { status: { in: verifiedStatuses }, isSynthetic: true }, _count: { _all: true } }),
    ]);
    const syntheticCounts = new Map(syntheticByMarket.map((item) => [item.launchMarketId, item._count._all]));
    return markets.map((market) => {
      const syntheticCount = syntheticCounts.get(market.id) ?? 0;
      return {
        ...market,
        verifiedCount: market._count.leads,
        realVerifiedCount: Math.max(0, market._count.leads - syntheticCount),
        syntheticCount,
        partnerCount: market._count.partners,
        readiness: this.readiness(market._count.leads, market.goal, market._count.partners, market.benefitsPrepared, market.eventsPrepared),
      };
    });
  }

  async adminMarketDetail(id: string) {
    const market = await this.prisma.launchMarket.findUnique({ where: { id }, include: { ubigeos: true } });
    if (!market) throw notFound('PRELAUNCH_MARKET_NOT_FOUND', 'No encontramos este departamento de lanzamiento.');

    const [leads, applications, partners, mappedMarkets] = await Promise.all([
      this.prisma.preLaunchLead.findMany({
        where: { launchMarketId: id },
        include: { market: { select: { id: true, name: true } }, _count: { select: { referrals: true } } },
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      this.prisma.businessPreLaunchApplication.findMany({
        include: { publishedPartner: { include: { market: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.preLaunchPartner.findMany({
        where: { marketId: id },
        include: { market: { select: { id: true, name: true } } },
        orderBy: [{ publicOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.launchMarket.findMany({ where: { isFallback: false }, select: { id: true, ubigeos: true } }),
    ]);

    const belongsToMarket = (application: typeof applications[number]) => {
      if (application.publishedPartner?.marketId === id) return true;
      if (market.isFallback) {
        return !mappedMarkets.some((candidate) => candidate.ubigeos.some((mapping) => this.locationMatches(mapping, application)));
      }
      return market.ubigeos.some((mapping) => this.locationMatches(mapping, application));
    };
    const marketApplications = applications.filter(belongsToMarket);
    const verified = leads.filter((lead) => lead.status === PreLaunchLeadStatus.VERIFIED || lead.status === PreLaunchLeadStatus.CONVERTED);
    const realVerified = verified.filter((lead) => !lead.isSynthetic);
    const syntheticVerified = verified.filter((lead) => lead.isSynthetic);
    const provinces = new Map<string, { name: string; department: string; real: number; synthetic: number; total: number; districts: Set<string> }>();
    verified.forEach((lead) => {
      const key = `${lead.departmentId}:${lead.provinceId}`;
      const current = provinces.get(key) ?? { name: lead.provinceName, department: lead.departmentName, real: 0, synthetic: 0, total: 0, districts: new Set<string>() };
      current.total += 1;
      current.districts.add(lead.districtName);
      if (lead.isSynthetic) current.synthetic += 1; else current.real += 1;
      provinces.set(key, current);
    });

    return {
      market: {
        ...market,
        verifiedCount: verified.length,
        realVerifiedCount: realVerified.length,
        syntheticCount: syntheticVerified.length,
        pendingCount: leads.filter((lead) => lead.status === PreLaunchLeadStatus.PENDING_OTP).length,
        partnerCount: partners.length,
        publicPartnerCount: partners.filter((partner) => partner.isPublic && (partner.status === PreLaunchPartnerStatus.PARTNER || partner.status === PreLaunchPartnerStatus.ACTIVE)).length,
        applicationCount: marketApplications.length,
        readiness: this.readiness(verified.length, market.goal, partners.filter((partner) => partner.isPublic).length, market.benefitsPrepared, market.eventsPrepared),
      },
      provinces: [...provinces.values()].map((item) => ({ ...item, districts: [...item.districts].sort() })).sort((a, b) => b.real - a.real || b.total - a.total),
      leads: leads.map(({ accessTokenHash: _secret, ...lead }) => lead),
      applications: marketApplications,
      partners,
    };
  }

  async upsertMarket(id: string | undefined, input: UpsertLaunchMarketDto) {
    if (input.status === LaunchMarketStatus.LAUNCH_SCHEDULED && !input.launchAt) {
      throw badRequest('LAUNCH_DATE_REQUIRED', 'Indica la fecha cuando el lanzamiento está programado.');
    }
    const market = await this.prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.launchMarket.update({ where: { id }, data: { name: clean(input.name), slug: input.slug, goal: input.goal, status: input.status, launchAt: input.status === LaunchMarketStatus.LAUNCH_SCHEDULED && input.launchAt ? new Date(input.launchAt) : null, publicOrder: input.publicOrder, isPublic: input.isPublic, benefitsPrepared: input.benefitsPrepared, eventsPrepared: input.eventsPrepared } })
        : await tx.launchMarket.create({ data: { name: clean(input.name), slug: input.slug, goal: input.goal, status: input.status, launchAt: input.status === LaunchMarketStatus.LAUNCH_SCHEDULED && input.launchAt ? new Date(input.launchAt) : null, publicOrder: input.publicOrder, isPublic: input.isPublic, benefitsPrepared: input.benefitsPrepared, eventsPrepared: input.eventsPrepared } });
      if (input.ubigeos) {
        await tx.launchMarketUbigeo.deleteMany({ where: { marketId: saved.id } });
        if (input.ubigeos.length) await tx.launchMarketUbigeo.createMany({ data: input.ubigeos.map((item) => ({ marketId: saved.id, ...item, mappingKey: item.ubigeoCode ?? `${item.departmentId}:${item.provinceId ?? '*'}:${item.districtId ?? '*'}` })) });
      }
      return saved;
    });
    return market;
  }

  adminApplications() { return this.prisma.businessPreLaunchApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 250 }); }
  updateApplicationStatus(id: string, status: BusinessPreLaunchApplicationStatus) { return this.prisma.businessPreLaunchApplication.update({ where: { id }, data: { status } }); }
  async publishBusinessApplication(id: string, input: PublishBusinessPreLaunchApplicationDto) {
    const [application, market] = await Promise.all([
      this.prisma.businessPreLaunchApplication.findUnique({ where: { id }, include: { publishedPartner: true } }),
      this.prisma.launchMarket.findUnique({ where: { id: input.marketId } }),
    ]);
    if (!application) throw notFound('PRELAUNCH_APPLICATION_NOT_FOUND', 'No encontramos esta solicitud comercial.');
    if (!market) throw notFound('PRELAUNCH_MARKET_NOT_FOUND', 'No encontramos el departamento seleccionado.');

    const data = {
      marketId: market.id,
      name: clean(input.publicName ?? application.businessName),
      category: clean(application.type),
      districtName: clean(application.districtName),
      logoUrl: optional(input.logoUrl),
      imageUrl: optional(input.imageUrl),
      benefitCount: input.benefitCount,
      status: PreLaunchPartnerStatus.PARTNER,
      isPublic: input.isPublic,
      publicOrder: input.publicOrder,
    };
    const partner = application.publishedPartner
      ? await this.prisma.preLaunchPartner.update({ where: { id: application.publishedPartner.id }, data })
      : await this.prisma.preLaunchPartner.create({ data: { ...data, sourceApplicationId: application.id, slug: await this.uniquePartnerSlug(application.businessName, application.id) } });
    const updatedApplication = await this.prisma.businessPreLaunchApplication.update({
      where: { id: application.id },
      data: { status: BusinessPreLaunchApplicationStatus.PARTNER },
      include: { publishedPartner: { include: { market: { select: { id: true, name: true } } } } },
    });
    return { application: updatedApplication, partner };
  }
  adminPartners() { return this.prisma.preLaunchPartner.findMany({ include: { market: { select: { id: true, name: true } } }, orderBy: { publicOrder: 'asc' } }); }
  upsertPartner(id: string | undefined, input: UpsertPreLaunchPartnerDto) {
    const data = { ...input, slug: input.slug.toLowerCase(), name: clean(input.name), category: clean(input.category), districtName: clean(input.districtName), logoUrl: optional(input.logoUrl), imageUrl: optional(input.imageUrl) };
    return id ? this.prisma.preLaunchPartner.update({ where: { id }, data }) : this.prisma.preLaunchPartner.create({ data });
  }

  async convertLead(leadId: string, userId: string) {
    const [lead, user] = await Promise.all([this.prisma.preLaunchLead.findUnique({ where: { id: leadId } }), this.prisma.user.findUnique({ where: { id: userId } })]);
    if (!lead?.phoneVerifiedAt) throw notFound('VERIFIED_LEAD_NOT_FOUND', 'No existe un registro verificado con ese identificador.');
    if (!user?.phoneVerifiedAt || `${user.phoneCountryCode}${user.phoneNumber}` !== lead.phoneE164) throw badRequest('PHONE_MISMATCH', 'La cuenta y el registro de prelanzamiento no comparten el mismo teléfono verificado.');
    const converted = await this.prisma.preLaunchLead.update({ where: { id: lead.id }, data: { convertedToUserId: user.id, convertedToUserAt: new Date(), status: PreLaunchLeadStatus.CONVERTED } });
    await this.prisma.preLaunchEvent.create({ data: { type: PreLaunchEventType.USER_CONVERTED, leadId: lead.id, launchMarketId: lead.launchMarketId } });
    return converted;
  }

  private async sendOtp(lead: { id: string; phoneCountryCode: string; phoneNumber: string; phoneE164: string; launchMarketId: string; sourceBusinessId: string | null }, client: ClientContext, turnstileToken?: string, resend = false) {
    if (resend) await this.verifyTurnstile(turnstileToken, client.ip);
    const ipHash = this.hashIp(client.ip);
    const resendSeconds = PRELAUNCH_OTP_RESEND_SECONDS;
    const last = await this.prisma.preLaunchOtp.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: 'desc' } });
    if (last && Date.now() - last.createdAt.getTime() < resendSeconds * 1000) throw badRequest('OTP_RESEND_TOO_SOON', `Espera ${resendSeconds} segundos antes de solicitar otro código.`);
    await this.assertRateLimit({ type: PreLaunchEventType.OTP_REQUESTED, ipHash, leadId: lead.id, maximum: PRELAUNCH_OTP_REQUEST_LIMIT, minutes: 60 });
    const code = this.verificationCodes.generateNumericCode();
    const expirationMinutes = PRELAUNCH_OTP_EXPIRATION_MINUTES;
    const codeHash = await this.verificationCodes.hash(code);
    const otp = await this.prisma.preLaunchOtp.create({
      data: { leadId: lead.id, codeHash, expiresAt: new Date(Date.now() + expirationMinutes * 60_000) },
    });
    try {
      await this.notifications.sendPreLaunchVerificationCode({ phoneCountryCode: lead.phoneCountryCode, phoneNumber: lead.phoneNumber, code, expirationMinutes });
    } catch (error) {
      // No dejamos un OTP que nunca fue entregado bloqueando el siguiente intento.
      await this.prisma.preLaunchOtp.deleteMany({ where: { id: otp.id } });
      throw error;
    }
    await this.prisma.$transaction([
      this.prisma.preLaunchOtp.updateMany({
        where: { leadId: lead.id, id: { not: otp.id }, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.preLaunchEvent.create({ data: { type: PreLaunchEventType.OTP_REQUESTED, leadId: lead.id, launchMarketId: lead.launchMarketId, sourceBusinessId: lead.sourceBusinessId, ipHash, userAgent: optional(client.userAgent) } }),
    ]);
  }

  private async leadByAccessToken(rawToken: string) {
    const tokenHash = this.hash(rawToken);
    const lead = await this.prisma.preLaunchLead.findFirst({
      where: { OR: [{ accessTokenHash: tokenHash }, { recoveryTokenHash: tokenHash }] },
      include: { market: true },
    });
    if (!lead) throw notFound('PRELAUNCH_ACCESS_NOT_FOUND', 'No encontramos este acceso anticipado.');
    return { ...lead, isRecoveryToken: lead.recoveryTokenHash === tokenHash };
  }

  private async resolveMarket(location: { departmentId: number; provinceId: number; districtId: number; ubigeoCode: string }) {
    const mappings = await this.prisma.launchMarketUbigeo.findMany({ where: { OR: [
      { ubigeoCode: location.ubigeoCode },
      { departmentId: location.departmentId, provinceId: location.provinceId, districtId: null },
      { departmentId: location.departmentId, provinceId: null, districtId: null },
    ] }, include: { market: true } });
    const mapping = mappings.sort((a, b) => Number(Boolean(b.ubigeoCode)) - Number(Boolean(a.ubigeoCode)) || Number(Boolean(b.provinceId)) - Number(Boolean(a.provinceId)))[0];
    if (mapping) return mapping.market;
    const fallback = await this.prisma.launchMarket.findFirst({ where: { isFallback: true } });
    if (!fallback) throw serviceUnavailable('LAUNCH_MARKET_NOT_CONFIGURED', 'Aún no configuramos el mercado de lanzamiento para esta zona.');
    return fallback;
  }

  private async verifyTurnstile(token: string | undefined, remoteIp?: string | null) {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    if (!secret) {
      if (isProduction) throw serviceUnavailable('BOT_PROTECTION_NOT_CONFIGURED', 'La protección del formulario no está disponible temporalmente.');
      return;
    }
    // El preview local no publica una site key. En producción el token sigue siendo obligatorio.
    if (!token && !isProduction) return;
    if (!token) throw badRequest('BOT_CHECK_REQUIRED', 'Completa la verificación de seguridad.');
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const result = await response.json() as { success?: boolean };
    if (!result.success) throw badRequest('BOT_CHECK_FAILED', 'No pudimos validar la verificación de seguridad. Inténtalo otra vez.');
  }

  private async assertRateLimit(input: { type: PreLaunchEventType; ipHash: string | null; leadId?: string; maximum: number; minutes: number }) {
    if (!input.ipHash && !input.leadId) return;
    const count = await this.prisma.preLaunchEvent.count({ where: { type: input.type, createdAt: { gte: new Date(Date.now() - input.minutes * 60_000) }, ...(input.ipHash ? { ipHash: input.ipHash } : {}), ...(input.leadId ? { leadId: input.leadId } : {}) } });
    if (count >= input.maximum) throw badRequest('RATE_LIMIT_EXCEEDED', 'Se alcanzó el límite temporal de solicitudes. Inténtalo más tarde.');
  }

  private recordEvent(type: PreLaunchEventType, lead: { id: string; launchMarketId: string; sourceBusinessId: string | null }, source: Partial<StartPreLaunchRegistrationDto>, client: ClientContext) {
    return this.prisma.preLaunchEvent.create({ data: { type, leadId: lead.id, launchMarketId: lead.launchMarketId, sourceBusinessId: lead.sourceBusinessId, sessionId: optional(source.sessionId), ipHash: this.hashIp(client.ip), userAgent: optional(client.userAgent), utmSource: optional(source.utmSource), utmMedium: optional(source.utmMedium), utmCampaign: optional(source.utmCampaign), landingOrigin: optional(source.landingOrigin) } });
  }

  private hashIp(ip?: string | null) { return ip ? this.hash(`${this.config.get<string>('PRELAUNCH_IP_HASH_SALT', 'beerry-prelaunch')}:${ip}`) : null; }
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private assertPrivacyAcceptance(accepted: boolean, version: string) {
    if (!accepted) throw badRequest('PRIVACY_ACCEPTANCE_REQUIRED', 'Debes leer y aceptar la Política de Privacidad.');
    if (clean(version) !== PRELAUNCH_PRIVACY_POLICY_VERSION) {
      throw badRequest('PRIVACY_POLICY_VERSION_OUTDATED', 'La Política de Privacidad cambió. Revísala y vuelve a aceptarla.');
    }
  }

  private async uniqueReferralCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomBytes(5).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 7).toUpperCase().padEnd(7, 'B');
      if (!(await this.prisma.preLaunchLead.findUnique({ where: { referralCode: code } }))) return code;
    }
    throw serviceUnavailable('REFERRAL_CODE_UNAVAILABLE', 'No pudimos crear el código de referido.');
  }

  private async uniquePartnerSlug(name: string, applicationId: string) {
    const base = name.toLocaleLowerCase('es-PE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54) || 'negocio';
    const candidates = [`${base}-${applicationId.slice(0, 6).toLowerCase()}`, `${base}-${randomBytes(3).toString('hex')}`];
    for (const slug of candidates) {
      if (!(await this.prisma.preLaunchPartner.findUnique({ where: { slug } }))) return slug;
    }
    throw serviceUnavailable('PARTNER_SLUG_UNAVAILABLE', 'No pudimos crear el identificador público del negocio.');
  }

  private locationMatches(mapping: { departmentId: number; provinceId: number | null; districtId: number | null; ubigeoCode: string | null }, location: { departmentId: number; provinceId: number; districtId: number; ubigeoCode: string }) {
    if (mapping.ubigeoCode) return mapping.ubigeoCode === location.ubigeoCode;
    if (mapping.departmentId !== location.departmentId) return false;
    if (mapping.provinceId !== null && mapping.provinceId !== location.provinceId) return false;
    return mapping.districtId === null || mapping.districtId === location.districtId;
  }

  private readiness(verified: number, goal: number, partners: number, benefits: number, events: number) {
    return Math.round(Math.min(100, ((Math.min(verified / goal, 1) + Math.min(partners / 10, 1) + Math.min(benefits / 20, 1) + Math.min(events / 4, 1)) / 4) * 100));
  }

  private async ensureDefaults() {
    const levels = [['Acceso anticipado', 0], ['Acceso anticipado +', 1], ['Prioridad', 3], ['Fundador', 5], ['Prioridad de lanzamiento', 10]] as const;
    await Promise.all(levels.map(([name, minimumReferrals], publicOrder) => this.prisma.preLaunchLevel.upsert({ where: { minimumReferrals }, create: { name, minimumReferrals, publicOrder }, update: {} })));
    const fallback = await this.prisma.launchMarket.upsert({ where: { slug: 'resto-del-peru' }, create: { name: 'Resto del Perú', slug: 'resto-del-peru', goal: 500, isPublic: false, isFallback: true, publicOrder: 99 }, update: { isFallback: true } });
    const locations = this.ubigeo.list();
    const seeds = [
      { name: 'Lima', slug: 'lima', goal: 3000, department: 'Lima', order: 1, status: LaunchMarketStatus.COLLECTING_DEMAND, launchAt: null },
      { name: 'La Libertad', slug: 'la-libertad', goal: 1000, department: 'La Libertad', order: 2, status: LaunchMarketStatus.COLLECTING_DEMAND, launchAt: null },
      { name: 'Arequipa', slug: 'arequipa', goal: 1500, department: 'Arequipa', order: 3, status: LaunchMarketStatus.COLLECTING_DEMAND, launchAt: null },
      { name: 'San Martín', slug: 'san-martin', goal: 500, department: 'San Martin', order: 4, status: LaunchMarketStatus.COLLECTING_DEMAND, launchAt: null },
    ];
    for (const seed of seeds) {
      const market = await this.prisma.launchMarket.upsert({ where: { slug: seed.slug }, create: { name: seed.name, slug: seed.slug, goal: seed.goal, publicOrder: seed.order, status: seed.status, launchAt: seed.launchAt }, update: {} });
      const department = locations.departments.find((item) => normalize(item.name) === normalize(seed.department));
      if (department) {
        const mappingKey = `${department.id}:*:*`;
        await this.prisma.launchMarketUbigeo.upsert({ where: { mappingKey }, create: { marketId: market.id, mappingKey, departmentId: department.id }, update: { marketId: market.id, provinceId: null, districtId: null, ubigeoCode: null } });
      }
    }
    void fallback;
  }
}

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const optional = (value?: string | null) => value?.trim() || null;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
