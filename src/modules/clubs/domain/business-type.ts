export enum BusinessType {
  CLUB = 'club',
  DISCOTECA = 'discoteca',
  KARAOKE = 'karaoke',
  BAR = 'bar',
  RESTOBAR = 'restobar',
  LOUNGE = 'lounge',
}

export function readBusinessType(value: string): BusinessType {
  const type = Object.values(BusinessType).find((type) => type === value);
  if (type === undefined) throw new Error('Invalid persisted business type.');
  return type;
}
