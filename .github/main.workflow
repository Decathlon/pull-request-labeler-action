workflow "Auto Label Pull Request" {
  resolves = ["PR label by Files"]
  on = "pull_request"
}

action "PR label by Files" {
  uses = "./"
  secrets = ["GITHUB_TOKEN"]
}

workflow "Milestone Closure" {
  on = "milestone"
  resolves = ["Upload Release Notes to Wiki"]
}

action "action-filter" {
  uses = "actions/bin/filter@master"
  args = "action closed"
}

action "Create Release Notes" {
  uses = "docker://decathlon/release-notes-generator-action:1.0.1"
  secrets = ["GITHUB_TOKEN"]
  needs = ["action-filter"]
  env = {
    USE_MILESTONE_TITLE = "true"
    OUTPUT_FOLDER = "temp_release_notes"
  }
}

action "Upload Release Notes to Wiki" {
  uses = "docker://decathlon/wiki-page-creator-action:1.0.0"
  needs = ["Create Release Notes"]
  secrets = [
    "GH_PAT",
  ]
  env = {
    ACTION_MAIL = "oss@decathlon.com"
    ACTION_NAME = "decathlon"
    OWNER = "dktunited"
    REPO_NAME = "developers-back"
    SKIP_MD = "README.md"
    MD_FOLDER = "temp_release_notes"
  }
}
