import { Club, Prisma } from '@prisma/client';
import { readBusinessType } from '../domain/business-type';
import { CLUB_SCHEDULE_DAYS, CLUB_SOCIAL_TYPES } from '../domain/club-profile';

function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value: Prisma.JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function coordinate(value: Prisma.JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Stored JSON is untrusted, including rows written before the current request DTOs. */
export function readClubAddress(value: Prisma.JsonValue) {
  const address = object(value);
  return {
    direccion: text(address.direccion),
    distrito: text(address.distrito),
    provincia: text(address.provincia),
    departamento: text(address.departamento),
    pais: text(address.pais),
    latitude: coordinate(address.latitude),
    longitude: coordinate(address.longitude),
    location: text(address.location),
  };
}

export function readClubContact(value: Prisma.JsonValue) {
  const contact = object(value);
  return { phone: text(contact.phone), email: text(contact.email) };
}

export function readClubSocialMedia(value: Prisma.JsonValue) {
  return (Array.isArray(value) ? value : []).flatMap((entry) => {
    const item = object(entry);
    const type = CLUB_SOCIAL_TYPES.find((type) => type === item.type);
    return type && typeof item.url === 'string' ? [{ type, url: item.url }] : [];
  });
}

export function readClubSchedule(value: Prisma.JsonValue) {
  return (Array.isArray(value) ? value : []).flatMap((entry) => {
    const item = object(entry);
    const day = CLUB_SCHEDULE_DAYS.find((day) => day === item.day);
    return day && typeof item.isOpen === 'boolean'
      ? [
          {
            day,
            isOpen: item.isOpen,
            openTime: text(item.openTime),
            closeTime: text(item.closeTime),
          },
        ]
      : [];
  });
}

/** Keep the administrative column names while exposing concrete profile structures. */
export function clubWithProfile(club: Club) {
  return {
    ...club,
    type: readBusinessType(club.type),
    addressJson: readClubAddress(club.addressJson),
    contactJson: readClubContact(club.contactJson),
    socialMediaJson: readClubSocialMedia(club.socialMediaJson),
    scheduleJson: readClubSchedule(club.scheduleJson),
  };
}
