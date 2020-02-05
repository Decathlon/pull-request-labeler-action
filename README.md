<p align="center">
  <img src="https://github.com/Decathlon/pull-request-labeler-action/raw/master/assets/intro.png" alt="Result illustration"/><br>
  <a href="https://app.fossa.io/projects/git%2Bgithub.com%2FDecathlon%2Fpull-request-labeler-action?ref=badge_shield"><img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2FDecathlon%2Fpull-request-labeler-action.svg?type=shield"></a>
  <a href="https://circleci.com/gh/Decathlon/pull-request-labeler-action/tree/master"><img src="https://circleci.com/gh/Decathlon/pull-request-labeler-action.svg?style=svg"></a>
  <br><br>
  This repository provides a GitHub action to <strong>automatically label a pull request</strong> based on committed files.
</p>

**Table of Contents**

- [Common usage](#common-usage)
- [Breaking change](#breaking-change)
- [Startup](#startup)
  - [Configuration](#configuration)
  - [Use GitHub action](#use-github-action)
    - [Settings for v1.0.0+ release (deprecated)](#settings-for-v100-release-deprecated)
    - [Settings for v2.0.0+ release](#settings-for-v200-release)
- [Contributing](#contributing)
  - [Commands](#commands)
- [License](#license)

## Common usage

When pushing, the action will be triggered and will look for committed files over your branch.
It applies configured labels whenever it find a file whose name matches the associated regular expression.

<p align="center">
  <img src="https://github.com/Decathlon/pull-request-labeler-action/raw/master/assets/screenshot.png" alt="Expected result after processing"/>
  <img src="https://github.com/Decathlon/pull-request-labeler-action/raw/master/assets/log.png" alt="Action log messages"/>
</p>

## Breaking change

Starting from August 2019, GitHub switch [Actions syntax from HCL to YAML](https://help.github.com/en/articles/migrating-github-actions-from-hcl-syntax-to-yaml-syntax).  
The previous syntax will no longer be supported by GitHub on September 30, 2019.

As a consequence, __please use v2.0.0+__ release and note that __all v1.x.x are deprecated__ and will no longer work on September 30, 2019.

## Startup

### Configuration

Create a file into your root project directory: `.github/label-pr.yml`:
```yaml
- regExp: ".*\\.ts+$"
  labels: ["typescript"]
- regExp: ".*\\.sql+$"
  labels: ["database", "critical"]
- regExp: ".*\\.md+$"
  labels: ["documentation"]
- regExp: "^(pom\\.xml|package\\.json|build\\.gradle)$"
  labels: ["dependencies"]
- regExp: ".*\\.(zip|jar|war|ear)+$"
  labels: ["artifact", "invalid"]
```
_This is a sample to illustrate how you can customize your settings by configuring your own regex and labels_

The configuration is made of a list of `Filter` which are composed of:
- `regExp`: a regular expression which will be tested over the filenames
- `labels`: a list of labels to apply if the filenames match

If the labels do not exist yet in your repository configuration, they will be created anyway.

### Use GitHub action

#### Settings for v1.0.0+ release (deprecated)

Create a file into your root project directory (if it does not exist yet): `.github/main.workflow`:
```
workflow "New workflow" {
  resolves = ["PR label by Files"]
  on = "pull_request"
}

action "PR label by Files" {
  uses = "decathlon/pull-request-labeler-action@v1.0.0"
  secrets = ["GITHUB_TOKEN"]
}
```

#### Settings for v2.0.0+ release

Create a file into your root project directory: `.github/workflows/labeler.yml`:
```yaml
# Workflow to associate labels automatically
name: labeler
# Trigger the workflow on pull request events
on: [pull_request]
jobs:
  label:
    runs-on: ubuntu-18.04
    steps:
      # We need to checkout the repository to access the configured file (.github/label-pr.yml)
      - uses: actions/checkout@v2
      - name: Labeler
        uses: docker://decathlon/pull-request-labeler-action:2.0.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Here we can override the path for the action configuration. If none is provided, default one is `.github/label-pr.yml`
          CONFIG_PATH: ${{ secrets.GITHUB_WORKSPACE }}/.github/label-pr.yml
```

_Please note that you can move the label-pr.yml to another location, if so, then do not forget to update the above **CONFIG_PATH**_ variable.

## Contributing

- The project is built using [Typescript](https://www.typescriptlang.org/) # `3.5.2`
- We use a [tslint](https://palantir.github.io/tslint/) as a linter for defining code style which configuration may change
- We use [Jest](https://jestjs.io/) as the testing framework

To start, you just need to clone the repository and open it in your favorite IDE.
You may need to set it up so it uses the node configuration (`package.json`) and tslint configuration (`tslint.json`).

### Commands
- To run unit tests: `npm run test:watch`
- To build: `npm run build:main`

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FDecathlon%2Fpull-request-labeler-action.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FDecathlon%2Fpull-request-labeler-action?ref=badge_large)
