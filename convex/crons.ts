import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// A hold is only useful while the guest is checking out. Releasing it promptly
// keeps the public “plates left” number truthful when a checkout is abandoned.
crons.interval(
  'expire abandoned chef-drop holds',
  { minutes: 1 },
  internal.inventory.expireReservationsOnSchedule,
  {},
);

export default crons;
