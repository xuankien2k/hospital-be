const DEMO_SNAPSHOT_TYPE = 'demo';

const PRODUCTION_SNAPSHOT_TYPES = ['monthly_auto', 'manual'];

function isTrendsDemoMode() {
  return String(process.env.TRENDS_DEMO_MODE || '').trim().toLowerCase() === 'true';
}

function getSnapshotScopeFilter() {
  if (isTrendsDemoMode()) {
    return { snapshotType: DEMO_SNAPSHOT_TYPE };
  }

  return { snapshotType: { $in: PRODUCTION_SNAPSHOT_TYPES } };
}

function getProductionSnapshotFilter() {
  return { snapshotType: { $in: PRODUCTION_SNAPSHOT_TYPES } };
}

function getDemoSnapshotFilter() {
  return { snapshotType: DEMO_SNAPSHOT_TYPE };
}

module.exports = {
  DEMO_SNAPSHOT_TYPE,
  PRODUCTION_SNAPSHOT_TYPES,
  isTrendsDemoMode,
  getSnapshotScopeFilter,
  getProductionSnapshotFilter,
  getDemoSnapshotFilter,
};
