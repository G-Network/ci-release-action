# CI Release Action
Used to automate builds on gihub action pipeline.

After each pull request is merged into selected branch, if the package.json version value changes it creates a new release/tag.
 - If param `deploy` is omitted or false, no further actions are taken
 - If param `deploy` is set to `'package'` after creating a new release also a npm package wil be published to the given registry
 - If param `deploy` is set to `'service'` sls will automatically deploy it to the cloud, but additional env variables should be set

## Example template

```yaml
name: Make release

on:
  pull_request:
    branches: master
    types: [closed]

jobs:
  release:
    runs-on: ubuntu-latest
    if: github.event.pull_request.merged == true # check if pull request was merged
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v1
      with:
        node-version: 12.x
        registry-url: 'https://npm.pkg.github.com'
    - uses: g-network/npm-release-action@v1
      with:
        deploy: package # publish npm package
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
