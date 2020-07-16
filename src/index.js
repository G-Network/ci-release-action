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
  }
}

/**
 * run the deployment if required
 */
async function runDeployment() {
  const deploy = core.getInput('deploy', { required: false });
  const type = core.getInput('type', { required: false });

  if (deploy && type === 'package') {
    await run('npm', 'publish');

    return;
  }

  if (deploy && type === 'service') {
    const key = core.getInput('awsKey', { required: true });
    const secret = core.getInput('awsSecret', { required: true });

    await run('npm', 'install', 'serverless', '-g');
    await run('sls', 'configure', '--provider aws', `--key ${key}`, `--secre ${secret}`);
    await run('sls', 'deploy');

    return;
  }

  return;
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
  }
})();
