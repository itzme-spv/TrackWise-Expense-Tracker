/**
 * jobs/recurringJob.js
 *
 * Recurring Transaction Scheduler — powered by node-cron
 *
 * Purpose:
 *   Automatically clones "template" transactions that have `isRecurring: true`
 *   at the appropriate frequency (Daily / Weekly / Monthly) by creating
 *   new Transaction documents that are identical copies except:
 *     - date        → today's date
 *     - isRecurring → false  (copies are not templates themselves)
 *     - isGeneratedCopy → true  (UI can badge them as "Auto")
 *
 * Cron Schedule:
 *   We run ONE cron job at 00:05 every day (5 minutes past midnight).
 *   Inside the handler, we check each recurring transaction's
 *   `lastGeneratedAt` timestamp to determine whether it's due for
 *   a new copy TODAY (daily), THIS WEEK (weekly), or THIS MONTH (monthly).
 *   This avoids running three separate cron jobs.
 *
 * Why check lastGeneratedAt instead of scheduling different crons?
 *   - Simpler to reason about — one place to debug
 *   - Resilient to server restarts — if the server was down at midnight,
 *     the 00:05 job will still fire and catch up correctly
 *   - Prevents duplicate generation even if the server restarts mid-day
 *     (because lastGeneratedAt is updated atomically after each generation)
 *
 * MERN Data Flow:
 *   node-cron trigger → recurringJob.processRecurring()
 *   → Transaction.find({ isRecurring: true })
 *   → For each: check if due → Transaction.create(copy) → update lastGeneratedAt
 *   → No HTTP request involved — runs entirely on the server
 *
 * Usage:
 *   Called once in server.js AFTER the DB connects:
 *     const { startRecurringJob } = require('./jobs/recurringJob');
 *     startRecurringJob();
 */

const cron = require("node-cron");
const Transaction = require("../models/Transaction");

// ─── Due-date Checkers ────────────────────────────────────────────────────────
/**
 * Returns true if a recurring transaction is due to generate a copy TODAY
 * based on its frequency and lastGeneratedAt timestamp.
 *
 * @param {Date|null}  lastGeneratedAt  — When the cron last created a copy
 * @param {string}     frequency        — 'Daily' | 'Weekly' | 'Monthly'
 * @returns {boolean}
 */
const isDueToday = (lastGeneratedAt, frequency) => {
  const now = new Date();

  // Never been generated — due immediately on first run
  if (!lastGeneratedAt) return true;

  const last = new Date(lastGeneratedAt);

  // Normalise to midnight for date-only comparisons
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const lastMidnight = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate(),
  );

  const daysDiff = Math.floor(
    (todayMidnight - lastMidnight) / (1000 * 60 * 60 * 24),
  );

  switch (frequency) {
    case "Daily":
      return daysDiff >= 1; // At least 1 full day since last generation

    case "Weekly":
      return daysDiff >= 7; // At least 7 days

    case "Monthly":
      // Due if we're in a different month/year from the last generation
      return (
        now.getMonth() !== last.getMonth() ||
        now.getFullYear() !== last.getFullYear()
      );

    default:
      return false;
  }
};

// ─── Core Processing Function ─────────────────────────────────────────────────
/**
 * processRecurring — the main logic executed on every cron tick.
 *
 * Fetches all active recurring transactions across ALL users and
 * generates copies for any that are due today.
 */
const processRecurring = async () => {
  const startTime = Date.now();
  console.log(`[RecurringJob] 🔄 Starting at ${new Date().toISOString()}`);

  let processed = 0;
  let generated = 0;
  let errors = 0;

  try {
    // Fetch all recurring template transactions
    // (isGeneratedCopy: false ensures we never recurse on auto-generated copies)
    const templates = await Transaction.find({
      isRecurring: true,
      isGeneratedCopy: false,
    }).lean();

    console.log(
      `[RecurringJob] Found ${templates.length} recurring template(s).`,
    );

    for (const template of templates) {
      processed++;

      try {
        if (
          !isDueToday(template.lastGeneratedAt, template.recurringFrequency)
        ) {
          // Not due yet — skip
          continue;
        }

        // Create a new copy of this transaction for today
        await Transaction.create({
          title: template.title,
          amount: template.amount,
          type: template.type,
          category: template.category,
          date: new Date(), // Today's date
          notes: template.notes || "",
          user_id: template.user_id,
          isRecurring: false, // Copies are not templates
          recurringFrequency: null,
          isGeneratedCopy: true, // Badge for the UI
        });

        // Update the template's lastGeneratedAt so we don't double-generate today
        await Transaction.findByIdAndUpdate(template._id, {
          lastGeneratedAt: new Date(),
        });

        generated++;
        console.log(
          `[RecurringJob] ✅ Generated copy for: "${template.title}" ` +
            `(${template.recurringFrequency}, user: ${template.user_id})`,
        );
      } catch (templateError) {
        errors++;
        console.error(
          `[RecurringJob] ❌ Failed for template ${template._id}:`,
          templateError.message,
        );
        // Continue processing remaining templates — don't abort the whole job
      }
    }
  } catch (err) {
    console.error(
      "[RecurringJob] ❌ Fatal error fetching templates:",
      err.message,
    );
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[RecurringJob] ✅ Done in ${elapsed}ms — ` +
      `Checked: ${processed}, Generated: ${generated}, Errors: ${errors}`,
  );
};

// ─── Job Registration ─────────────────────────────────────────────────────────
/**
 * startRecurringJob()
 *
 * Registers the cron schedule and runs a one-time check on startup
 * (in case the server was down at the scheduled time).
 *
 * Cron expression: '5 0 * * *'
 *   ┌─────────────── minute (5)
 *   │ ┌───────────── hour (0 = midnight)
 *   │ │ ┌─────────── day of month (every day)
 *   │ │ │ ┌───────── month (every month)
 *   │ │ │ │ ┌─────── day of week (every day)
 *   5 0 * * *
 *
 * Called from server.js after the MongoDB connection is established.
 */
const startRecurringJob = () => {
  if (!cron.validate("5 0 * * *")) {
    console.error("[RecurringJob] Invalid cron expression. Job not started.");
    return;
  }

  // Schedule the daily job
  cron.schedule("5 0 * * *", processRecurring, {
    timezone: "Asia/Kolkata", // IST — matches the ₹ Indian user base
  });

  console.log("[RecurringJob] 📅 Scheduled — runs daily at 00:05 IST.");

  // Run once immediately on startup to catch up any missed generations
  // (e.g., if the server was restarted at 00:10)
  processRecurring().catch((err) => {
    console.error("[RecurringJob] Startup run failed:", err.message);
  });
};

module.exports = { startRecurringJob, processRecurring };
