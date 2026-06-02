/**
 * Capability Map - Single source of truth for role → capability mapping
 *
 * Capabilities are strings that represent specific permissions or access levels.
 * Roles are arrays of capabilities that users with that role possess.
 *
 * 'public' role includes capabilities available to unauthenticated users.
 */

export type Capability =
  | 'route:/app'
  | 'route:/app/admin'
  | 'route:/app/admin.users'
  | 'route:/app/admin.stats'
  | 'route:/app/profile'
  | 'user.write'
  | 'user.bootstrap'
  | 'profile.read'
  | 'profile.write'
  | 'util.firstUserCheck'
  | 'util.emailServiceStatus'
  | 'dashboard.read';

export const Caps = {
  'route:/app': ['seller', 'platform_admin'],
  'route:/app/admin': ['platform_admin'],
  'route:/app/admin.users': ['platform_admin'],
  'route:/app/admin.stats': ['platform_admin'],
  'route:/app/profile': ['seller', 'platform_admin'],
  'user.write': ['platform_admin'],
  'user.bootstrap': ['public', 'seller', 'platform_admin'],
  'profile.read': ['seller', 'platform_admin'],
  'profile.write': ['seller', 'platform_admin'],
  'util.firstUserCheck': ['public', 'seller', 'platform_admin'],
  'util.emailServiceStatus': ['public', 'seller', 'platform_admin'],
  'dashboard.read': ['platform_admin'],
} as const;

export const PublicCaps = new Set<Capability>([
  'util.firstUserCheck',
  'util.emailServiceStatus',
  'user.bootstrap',
]);
