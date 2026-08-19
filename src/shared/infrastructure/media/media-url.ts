import { ConfigService } from '@nestjs/config';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const PUBLIC_MEDIA_PATH = '/api/v1/media';

const encodeObjectKey = (value: string) =>
  value.split('/').filter(Boolean).map(encodeURIComponent).join('/');

export const buildMediaUrl = (
  objectKey: string | null | undefined,
  config: ConfigService,
): string | null => {
  const normalizedKey = normalizeStoredMediaValue(objectKey);
  if (!normalizedKey) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedKey)) {
    return normalizedKey;
  }

  const mediaBaseUrl = resolvePublicMediaBaseUrl(config);

  if (mediaBaseUrl) {
    return `${trimTrailingSlash(mediaBaseUrl)}/${normalizedKey}`;
  }

  if (normalizedKey.startsWith('media/')) {
    return `${PUBLIC_MEDIA_PATH}/${encodeObjectKey(normalizedKey)}`;
  }

  const bucket = config.get<string>('AWS_S3_BUCKET');
  const region = config.get<string>('AWS_REGION');
  if (!bucket || !region) {
    return normalizedKey;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
};

export const normalizeStoredMediaValue = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const extractObjectKeyFromUrl = (
  value: string | null | undefined,
  config: ConfigService,
): string | null => {
  const normalized = normalizeStoredMediaValue(value);
  if (!normalized) {
    return null;
  }

  if (!/^https?:\/\//i.test(normalized)) {
    if (normalized.startsWith(`${PUBLIC_MEDIA_PATH}/`)) {
      return decodeURIComponent(normalized.slice(PUBLIC_MEDIA_PATH.length + 1));
    }
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const bucket = config.get<string>('AWS_S3_BUCKET');
    const region = config.get<string>('AWS_REGION');
    const mediaBaseUrl = resolvePublicMediaBaseUrl(config);

    if (mediaBaseUrl) {
      const base = new URL(trimTrailingSlash(mediaBaseUrl));
      if (base.origin === url.origin) {
        return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      }
    }

    const bucketHost = bucket && region ? `${bucket}.s3.${region}.amazonaws.com` : null;
    if (bucketHost && url.hostname === bucketHost) {
      return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    }

    if (bucket && url.hostname === 's3.amazonaws.com') {
      const parts = url.pathname.replace(/^\/+/, '').split('/');
      if (parts.shift() === bucket) {
        return decodeURIComponent(parts.join('/'));
      }
    }
  } catch {
    return null;
  }

  return null;
};

const resolvePublicMediaBaseUrl = (config: ConfigService): string | null => {
  const explicit = config.get<string>('MEDIA_PUBLIC_URL') ?? config.get<string>('CDN_URL');
  if (explicit?.trim()) return explicit.trim();

  const cloudFront = config.get<string>('AWS_CLOUDFRONT_URL')?.trim();
  if (!cloudFront) return null;

  try {
    const hostname = new URL(cloudFront).hostname.toLowerCase();
    if (hostname.endsWith('.cloudfront.net')) return cloudFront;
  } catch {
    return null;
  }
  return null;
};
