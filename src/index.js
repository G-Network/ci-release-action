const fs = require("fs");
const path = require("path");
const core = require("@actions/core");
const exec = require("@actions/exec");
const { GitHub, context } = require("@actions/github");
const octokit = new GitHub(process.env.GITHUB_TOKEN);

async function run(cmd, ...params) {
  const options = {
    failOnStdErr: false
  };
  return exec.exec(cmd, params, options);
}

async function createDeployment(type) {
  if (type === "package") {
    await run("npm", "publish");
  } else if (type === "service") {
    await run("npm", "install", "serverless", "-g");
    await run("serverless", "deploy");
  } else {
    throw new Error("Invalid deployment type");
  }
}

function getCurrentVerison() {
  const { version } = require(path.join(
    process.env.GITHUB_WORKSPACE,
    "package.json"
  ));
  return version;
}

function getCurrentRelease() {
  const { owner, repo } = context.repo;
  return octokit.repos
    .getLatestRelease({
      owner,
      repo
    })
    .then(res => {
      return res.data.tag_name.replace(/[a-zA-Z\s]+/, "");
    })
    .catch(() => {
      return "none";
    });
}

function createNewRelease(version) {
  const { owner, repo } = context.repo;
  return octokit.repos.createRelease({
    owner,
    repo,
    tag_name: version,
    name: `Release v${version}`
  });
}

(async () => {
  core.exportVariable("NODE_AUTH_TOKEN", process.env.GITHUB_TOKEN);
  const skipVersionCheck = core.getInput("skip_version_check", { required: false });
  const deployType = core.getInput("deploy", { required: false });
  try {
    const currentRelease = await getCurrentRelease();
    const currentVersion = await getCurrentVerison();

    console.log("Current release: ", currentRelease);
    console.log("Current version: ", currentVersion);

    if (currentRelease !== currentVersion) {
      console.log("Creating new release: ", currentVersion);
      await createNewRelease(currentVersion);
      await createDeployment(deployType);
      core.setOutput("version", currentVersion);
    } else if (skipVersionCheck && deployType === 'service') {
      console.log("Current release: ", currentRelease);
      await createDeployment(deployType);
    } else {
      core.setOutput("version", 'false');
    }
    core.exportVariable("NODE_AUTH_TOKEN", "XXXXX-XXXXX-XXXXX-XXXXX");
    core.exportVariable("GITHUB_TOKEN", "XXXXX-XXXXX-XXXXX-XXXXX");
  } catch (error) {
    core.setFailed(error.message);
  }
})();
