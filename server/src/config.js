// Central limits: tweak these numbers to tighten or relax anti-abuse rules.
export const LIMITS = {
  openGigs: 5,            // active gigs per client at the same time
  gigsPerDay: 5,          // new gigs per client per 24h
  pendingHires: 5,        // hire requests waiting for an answer, per client
  newChatsPerDay: 20,     // new conversations a user can start per 24h
  cancelStrikes: 3,       // cancellations after acceptance (30 days) before a restriction
  cancelWindowDays: 30,
  restrictDays: 7,
  reportRestrictDays: 3,
  reportsToRestrict: 3,   // distinct reporters before an automatic temporary restriction
  bookingExpiryHours: 72,
  msgMax: 1000,
  minBudget: 300,
  maxBudget: 1_000_000,
};

// Money rules (Pakistani rupees). Change these to your real business and tax rules.
export const MONEY = {
  commissionRate: Number(process.env.COMMISSION_RATE ?? 0.1), // SkillSpot keeps 10% of every paid job
  taxRate: Number(process.env.TAX_RATE ?? 0.05),               // withheld on the freelancer's earning (placeholder, set your legal rate)
};
export const MARKET = {
  activeServices: 10,       // services one freelancer can keep live
  proposalsPerDay: 20,      // proposals a freelancer can send per day
  communityPerMinute: 8,    // community messages per user per minute
  communityMax: 500,
  farLocationKm: 60,        // GPS this far from the entered city is flagged for the admin
  moveRecheckKm: 100,       // moving this far after approval sends the account back for a location check
};
