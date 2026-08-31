const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CHECK_MODE = process.argv.includes('--check');
const FALLBACK_DATABASE_URL = 'postgresql://openapi:openapi@127.0.0.1:5432/openapi';
const environment = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || FALLBACK_DATABASE_URL,
};

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: ROOT,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNodeModule(moduleId, arguments_) {
  run(process.execPath, [require.resolve(moduleId, { paths: [ROOT] }), ...arguments_]);
}

runNodeModule('prisma/build/index.js', ['generate']);
runNodeModule('typescript/bin/tsc', ['-b', 'tsconfig.build.json', '--clean']);
run(process.execPath, [
  path.join(ROOT, 'scripts', 'generate-openapi-response-schemas.cjs'),
  ...(CHECK_MODE ? ['--check'] : []),
]);
runNodeModule('@nestjs/cli/bin/nest.js', ['build']);
run(process.execPath, [path.join(ROOT, 'dist', 'src', 'generate-openapi.js')]);

if (CHECK_MODE) {
  run(process.execPath, [path.join(ROOT, 'scripts', 'check-openapi.cjs')]);
}
