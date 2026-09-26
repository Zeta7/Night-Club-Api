export const CLUB_SOCIAL_TYPES = ['tiktok', 'instagram', 'facebook', 'web'] as const;
export type ClubSocialType = (typeof CLUB_SOCIAL_TYPES)[number];

export const CLUB_SCHEDULE_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type ClubScheduleDay = (typeof CLUB_SCHEDULE_DAYS)[number];
