import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const releaseboxConfig = JSON.parse(fs.readFileSync(path.join(root, 'releasebox.config.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
const failures = [];
const requireField = (condition, message) => { if (!condition) failures.push(message); };

requireField(packageJson.repository, 'package.json must declare repository metadata');
requireField(Array.isArray(packageJson.files) && packageJson.files.length > 0, 'package.json must declare a non-empty files allowlist');
requireField(scripts['package:smoke'], 'package.json scripts must include package:smoke');
requireField(scripts['release:check'], 'package.json scripts must include release:check');
requireField(/npm run release:readiness/.test(scripts['release:check'] ?? ''), 'release:check must run npm run release:readiness');
requireField(/npm run release:contract/.test(scripts['release:check'] ?? ''), 'release:check must run npm run release:contract');
requireField(releaseboxConfig.release?.publishNpm === true, 'releasebox.config.json must enable npm publication');

const workflowDir = path.join(root, '.github', 'workflows');
if (fs.existsSync(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file));
  requireField(workflowFiles.length > 0, 'repository must include at least one workflow file');
  for (const file of workflowFiles) {
    const workflow = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    requireField(!/TODO|FIXME|template becomes an app|customization TODO/i.test(workflow), '.github/workflows/' + file + ' still contains placeholder text');
  }
  const combined = workflowFiles.map((file) => fs.readFileSync(path.join(workflowDir, file), 'utf8')).join('\n');
  requireField(/release:check/.test(combined), 'CI workflows must run npm run release:check');

  const releaseWorkflowPath = path.join(workflowDir, 'release.yml');
  requireField(fs.existsSync(releaseWorkflowPath), 'repository must include .github/workflows/release.yml');
  if (fs.existsSync(releaseWorkflowPath)) {
    const releaseWorkflow = fs.readFileSync(releaseWorkflowPath, 'utf8');
    const validationIndex = releaseWorkflow.indexOf('Validate tag and package identity');
    const packIndex = releaseWorkflow.indexOf('npm pack --json --pack-destination');
    const publishIndex = releaseWorkflow.indexOf('npm publish "${{ steps.package.outputs.tarball }}"');
    const githubReleaseIndex = releaseWorkflow.indexOf('gh release create');

    requireField(validationIndex >= 0, 'release workflow must validate tag and package identity');
    requireField(packIndex > validationIndex, 'release workflow must pack only after identity validation');
    requireField(publishIndex > packIndex, 'release workflow must publish the validated tarball after validation');
    requireField(githubReleaseIndex > publishIndex, 'GitHub release must be created after npm publication');
    requireField(releaseWorkflow.includes('--provenance --access public'), 'npm publication must use provenance and public access');
    requireField(releaseWorkflow.includes('"${{ steps.package.outputs.tarball }}"'), 'release workflow must use the explicit tarball output');
    requireField(!/^\s*run:\s+gh release create.*\*\.tgz/m.test(releaseWorkflow), 'GitHub release must not use a tarball wildcard');
  }
}

if (failures.length > 0) {
  console.error('Release readiness validation failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Release readiness validation passed.');
