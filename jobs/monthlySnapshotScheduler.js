const { captureMonthSnapshot } = require('../services/snapshotService');

const DAY_MS = 24 * 60 * 60 * 1000;
let schedulerStarted = false;

function startMonthlySnapshotScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const run = async () => {
    try {
      const result = await captureMonthSnapshot();
      if (result.created) {
        console.log(`[snapshot] Created monthly snapshot ${result.snapshot.periodKey}`);
      }
    } catch (error) {
      console.error('[snapshot] Monthly snapshot failed:', error);
    }
  };

  run();
  setInterval(run, DAY_MS);
}

module.exports = { startMonthlySnapshotScheduler };
