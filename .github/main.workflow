workflow "New workflow" {
  resolves = ["PR label by Files"]
  on = "pull_request"
}

action "PR label by Files" {
  uses = "./"
  secrets = ["GITHUB_TOKEN"]
}
