import type { Doc } from '@convex/_generated/dataModel';

export type UserProfile = Doc<'userProfiles'>;
export type UserRole = UserProfile['role'];

export const USER_ROLES = {
  SELLER: 'seller',
  PLATFORM_ADMIN: 'platform_admin',
  // Compatibility aliases for account-management code that predates the
  // chef/platform role vocabulary.
  USER: 'seller',
  ADMIN: 'platform_admin',
} as const satisfies Record<string, UserRole>;

export const DEFAULT_ROLE: UserRole = USER_ROLES.SELLER;
