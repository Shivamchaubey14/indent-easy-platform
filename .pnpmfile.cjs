// pnpm resolves an optional peer whenever the package exists anywhere in the workspace. The
// mobile app installs expo-sqlite, so drizzle-orm's optional expo-sqlite peer would then be
// resolved for the API as well, pulling Expo and React Native into the API image (~500 MB).
// Dropping that one peer keeps it out; the mobile app depends on expo-sqlite directly and Metro
// resolves it from there.
function readPackage(pkg) {
  if (pkg.name === 'drizzle-orm') {
    delete pkg.peerDependencies?.['expo-sqlite'];
    delete pkg.peerDependenciesMeta?.['expo-sqlite'];
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
