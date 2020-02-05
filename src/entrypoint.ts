import {Toolkit, ToolkitOptions} from 'actions-toolkit';
// tslint:disable-next-line:no-submodule-imports
import {WebhookPayloadWithRepository} from 'actions-toolkit/lib/context';
// tslint:disable-next-line:no-submodule-imports
import {Exit} from 'actions-toolkit/lib/exit';
// tslint:disable-next-line:no-submodule-imports
import {LoggerFunc, Signale} from 'signale';
import {Filter, Repository} from './types';
import {
  buildIssueRemoveLabelParams,
  filterConfiguredIssueLabels,
  intersectLabels,
  processListFilesResponses
} from './utils';
import {Octokit} from "@octokit/rest";
import IssuesListLabelsOnIssueParams = Octokit.IssuesListLabelsOnIssueParams;
import IssuesListLabelsOnIssueResponse = Octokit.IssuesListLabelsOnIssueResponse;
import PullsListFilesParams = Octokit.PullsListFilesParams;
import PullsListFilesResponseItem = Octokit.PullsListFilesResponseItem;
import Response = Octokit.Response;
import PullsListFilesResponse = Octokit.PullsListFilesResponse;
import IssuesAddLabelsParams = Octokit.IssuesAddLabelsParams;
import IssuesAddLabelsResponseItem = Octokit.IssuesAddLabelsResponseItem;
import IssuesGetParams = Octokit.IssuesGetParams;

const LOGO: string = `
██████╗ ███████╗ ██████╗ █████╗ ████████╗██╗  ██╗██╗      ██████╗ ███╗   ██╗
██╔══██╗██╔════╝██╔════╝██╔══██╗╚══██╔══╝██║  ██║██║     ██╔═══██╗████╗  ██║
██║  ██║█████╗  ██║     ███████║   ██║   ███████║██║     ██║   ██║██╔██╗ ██║
██║  ██║██╔══╝  ██║     ██╔══██║   ██║   ██╔══██║██║     ██║   ██║██║╚██╗██║
██████╔╝███████╗╚██████╗██║  ██║   ██║   ██║  ██║███████╗╚██████╔╝██║ ╚████║
╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝
`;

const args: ToolkitOptions = {
  event: ['pull_request.opened', 'pull_request.synchronize'],
  secrets: ['GITHUB_TOKEN']
};

// Returns the repository information using provided gitHubEventPath
const findRepositoryInformation = (gitHubEventPath: string, log: LoggerFunc & Signale, exit: Exit): IssuesListLabelsOnIssueParams => {
  const payload: WebhookPayloadWithRepository = require(gitHubEventPath);
  if (payload.number === undefined) {
    exit.neutral('Action not triggered by a PullRequest action. PR ID is missing')
  }
  log.info(`Checking files list for PR#${payload.number}`);
  return {
    issue_number: payload.number,
    owner: payload.repository.owner.login,
    repo: payload.repository.name
  };
};

// Find configured filters from the issue labels
const findIssueLabels = (octokit: Octokit, issuesGetParams: IssuesGetParams, filters: Filter[]): Promise<string[]> => {
  // Find issue labels that are configured in .github/label-pr.yml
  return octokit.issues.listLabelsOnIssue(issuesGetParams)
    .then(({data: labels}: Response<IssuesListLabelsOnIssueResponse>) => labels.reduce((acc, label) => acc.concat(label.name), []))
    .then(issueLabels => filterConfiguredIssueLabels(issueLabels, filters));
};

// Remove provided labels
const removeIssueLabels = (octokit: Octokit, labels: string[], {log, exit}: Toolkit, repository: Repository): void => {
  log.info('Labels to remove: ', labels);
  buildIssueRemoveLabelParams(repository, labels)
    .forEach(value => octokit.issues.removeLabel(value).catch(reason => exit.failure(reason)));
};

// Build labels to add
const getLabelsToAdd = (labels: string[], issueLabels: string[], {log, exit}: Toolkit): string[] => {
  const labelsToAdd: string[] = intersectLabels(labels, issueLabels);
  log.info('Labels to add: ', labelsToAdd);
  if (labelsToAdd.length === 0) {
    exit.success("No labels to add");
  }
  return labelsToAdd;
};

// Fetch all files (by recursively calling with page and per_page parameters)
const fetchAllFiles = (octokit: Octokit, pullListFilesParams: PullsListFilesParams, log): Promise<PullsListFilesResponseItem[]> => {
  log.info(`Listing files (page: ${pullListFilesParams.page} | per_page: ${pullListFilesParams.per_page})...`);
  return octokit.pulls.listFiles(pullListFilesParams)
    .then((response: Response<PullsListFilesResponse>) => {
      // If there may be other files to fetch
      log.info(`Loaded ${response.data.length} files`);
      let pullsListFilesResponseItems: PullsListFilesResponse = response.data;
      if (pullsListFilesResponseItems.length >= pullListFilesParams.per_page) {
        return fetchAllFiles(octokit, {
          page: pullListFilesParams.page + 1,
          ...pullListFilesParams
        }, log).then(value => value.concat(pullsListFilesResponseItems));
      }
      return pullsListFilesResponseItems;
    });
};


Toolkit.run(async (toolkit: Toolkit) => {
    toolkit.log.info('Open sourced by\n' + LOGO);

    toolkit.log.info('Running Action');
    const configPath: string = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : '.github/label-pr.yml';
    const filters: Filter[] = toolkit.config(configPath);
    toolkit.log.info(" Configured filters: ", filters);

    if (!process.env.GITHUB_EVENT_PATH) {
      toolkit.exit.failure('Process env GITHUB_EVENT_PATH is undefined');
    } else {
      const {owner, issue_number, repo}: IssuesListLabelsOnIssueParams = findRepositoryInformation(process.env.GITHUB_EVENT_PATH, toolkit.log, toolkit.exit);

      let issuesGetParams: Octokit.IssuesGetParams = {
        owner,
        repo,
        issue_number
      };
      const octokit = new Octokit();

      // First, we need to retrieve the existing issue labels and filter them over the configured one in config file
      const issueLabels: string[] = await findIssueLabels(octokit, issuesGetParams, filters);

      const params: PullsListFilesParams = {owner, pull_number: issue_number, repo, page: 1, per_page: 100};

      await fetchAllFiles(octokit, params, toolkit.log)
        .then((files: PullsListFilesResponseItem[]) => {
          toolkit.log.info('Checking files...', files.reduce((acc: string[], file: PullsListFilesResponseItem) => acc.concat(file.filename), []));
          return files;
        })
        .then((files: PullsListFilesResponseItem[]) => processListFilesResponses(files, filters))
        .then((eligibleFilters: Filter[]) => eligibleFilters.reduce((acc: string[], eligibleFilter: Filter) => acc.concat(eligibleFilter.labels), []))
        .then((labels: string[]) => {
            removeIssueLabels(octokit, intersectLabels(issueLabels, labels), toolkit, {owner, issue_number, repo});
            return {issue_number, labels: getLabelsToAdd(labels, issueLabels, toolkit), owner, repo};
          }
        )
        .then((addLabelsParams: IssuesAddLabelsParams) => octokit.issues.addLabels(addLabelsParams))
        .catch(reason => toolkit.exit.failure(reason))
        .then((value: Response<IssuesAddLabelsResponseItem[]>) => toolkit.log.info(`Adding label status: ${value.status}`));
    }
    toolkit.exit.success('Labels were update into pull request')
  },
  args
);
