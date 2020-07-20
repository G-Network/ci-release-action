const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const { GitHub, context } = require('@actions/github');
const octokit = new GitHub(process.env.GITHUB_TOKEN);

/**
 * Run the shell command
 * @param {string} cmd
 * @param  {...any} params
 */
async function run(cmd, ...params) {
  const options = {
    failOnStdErr: false,
  };
  return exec.exec(cmd, params, options);
}

/**
 * Get current working branch
 */
function getCurrentBranch() {
  return process.env.GITHUB_REF.split('/').pop();
}

/**
 * Get current deployment version
 */
function getCurrentVerison() {
  const { version } = require(path.join(process.env.GITHUB_WORKSPACE, 'package.json'));
  return version;
}

/**
 * get current release version
 */
function getCurrentRelease() {
  const { owner, repo } = context.repo;
  return octokit.repos
    .getLatestRelease({
      owner,
      repo,
    })
    .then((res) => {
      return res.data.tag_name.replace(/[a-zA-Z\s]+/, '');
    })
    .catch(() => {
      return 'none';
    });
}

/**
 * Create new release if required
 */
async function createRelease() {
  const release = core.getInput('release', { required: false });
  const publish = core.getInput('publish', { required: false });
  const currentRelease = await getCurrentRelease();
  const currentVersion = await getCurrentVerison();
  if (release && currentRelease !== currentVersion) {
    const { owner, repo } = context.repo;
    await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: currentVersion,
      name: `Release v${currentVersion}`,
    });
    console.log(`New release created: ${currentVersion}`);

    // we can pablish new package only for new release
    if (publish) {
      await run('npm', 'publish');
    }
  }
}

/**
 * run the deployment if required
 */
async function runDeployment() {
  const deploy = core.getInput('deploy', { required: false });

  if (deploy) {
    const key = process.env.AWS_ACCESS_KEY_ID;
    const secret = process.env.AWS_SECRET_ACCESS_KEY;

    await run('npm', 'install', 'serverless', '-g');
    // await run('sls', 'config', 'credentials', '--provider aws', `--key ${key}`, `--secret ${secret}`);
    await run('sls', 'deploy');
  }
}

/**
 * Action execution
 */
(async () => {
  const branchName = getCurrentBranch();
  core.exportVariable('NODE_AUTH_TOKEN', process.env.GITHUB_TOKEN);
  core.exportVariable('BRANCH_NAME', branchName);

  try {
    await createRelease();
    await runDeployment();
  } catch (error) {
    core.setFailed(error.message);
  } finally {
    core.exportVariable('NODE_AUTH_TOKEN', 'XXXXX-XXXXX-XXXXX-XXXXX');
    core.exportVariable('AWS_ACCESS_KEY_ID', 'XXXXX-XXXXX-XXXXX-XXXXX');
    core.exportVariable('AWS_SECRET_ACCESS_KEY', 'XXXXX-XXXXX-XXXXX-XXXXX');
  }
})();
