import { ConfigService } from '@nestjs/config';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

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

  const mediaBaseUrl =
    config.get<string>('MEDIA_PUBLIC_URL') ??
    config.get<string>('CDN_URL') ??
    config.get<string>('AWS_CLOUDFRONT_URL');

  if (mediaBaseUrl) {
    return `${trimTrailingSlash(mediaBaseUrl)}/${normalizedKey}`;
  }

  const bucket = config.get<string>('AWS_S3_BUCKET');
  const region = config.get<string>('AWS_REGION');
  if (!bucket || !region) {
    return normalizedKey;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
};

export const normalizeStoredMediaValue = (
  value: string | null | undefined,
): string | null => {
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
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const bucket = config.get<string>('AWS_S3_BUCKET');
    const region = config.get<string>('AWS_REGION');
    const mediaBaseUrl =
      config.get<string>('MEDIA_PUBLIC_URL') ??
      config.get<string>('CDN_URL') ??
      config.get<string>('AWS_CLOUDFRONT_URL');

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
