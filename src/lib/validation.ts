export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;

export function isAcceptedImageType(type: string) {
  return ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number]);
}
