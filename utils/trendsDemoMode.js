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

function resolveSnapshotScopeFilter(demo) {
  if (demo === true) {
    return getDemoSnapshotFilter();
  }

  if (demo === false) {
    return getProductionSnapshotFilter();
  }

  return getSnapshotScopeFilter();
}

function resolveDemoModeFlag(demo) {
  if (demo === true) {
    return true;
  }

  if (demo === false) {
    return false;
  }

  return isTrendsDemoMode();
}

module.exports = {
  DEMO_SNAPSHOT_TYPE,
  PRODUCTION_SNAPSHOT_TYPES,
  isTrendsDemoMode,
  getSnapshotScopeFilter,
  getProductionSnapshotFilter,
  getDemoSnapshotFilter,
  resolveSnapshotScopeFilter,
  resolveDemoModeFlag,
};
