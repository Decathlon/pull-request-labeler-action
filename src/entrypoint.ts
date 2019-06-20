import { IssuesAddLabelsParams, IssuesAddLabelsResponseItem, IssuesListLabelsOnIssueParams, IssuesListLabelsOnIssueResponse, PullsListFilesParams, PullsListFilesResponse, PullsListFilesResponseItem, Response } from '@octokit/rest';
import { Toolkit, ToolkitOptions } from 'actions-toolkit';
// tslint:disable-next-line:no-submodule-imports
import { WebhookPayloadWithRepository } from 'actions-toolkit/lib/context';
// tslint:disable-next-line:no-submodule-imports
import { Exit } from 'actions-toolkit/lib/exit';
// tslint:disable-next-line:no-submodule-imports
import { GitHub } from 'actions-toolkit/lib/github';
import { LoggerFunc, Signale } from 'signale';
import { Filter, Repository } from './types';
import { buildIssueRemoveLabelParams, processListFilesResponses } from './utils';

const args: ToolkitOptions = {
  event: ['pull_request.opened', 'pull_request.synchronize'],
  secrets: ['GITHUB_TOKEN']
};

const findRepositoryInformation = (gitHubEventPath: string, log: LoggerFunc & Signale, exit: Exit): Repository => {
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

Toolkit.run(async (toolkit: Toolkit) => {
    toolkit.log.info('Running Action');
    const filters: Filter[] = toolkit.config('.github/label-pr.yml');
    toolkit.log.info(" Configured filters: ", filters);

    if (!process.env.GITHUB_EVENT_PATH) {
      toolkit.exit.failure('Process env GITHUB_EVENT_PATH is undefined');
    } else {
      const { owner, issue_number, repo }: Repository = findRepositoryInformation(process.env.GITHUB_EVENT_PATH, toolkit.log, toolkit.exit);
      const params: PullsListFilesParams = { owner, pull_number: issue_number, repo };
      const { pulls: { listFiles }, issues }: GitHub = toolkit.github;

      const issuesListLabelsOnIssueParams: IssuesListLabelsOnIssueParams = { issue_number, owner, repo };
      // Remove issue labels that are configured in .github/label-pr.yml
      await issues.listLabelsOnIssue(issuesListLabelsOnIssueParams)
        .then(({ data }: Response<IssuesListLabelsOnIssueResponse>) => data.reduce((acc, item) => acc.concat(item.name), []))
        .then(issueLabels => buildIssueRemoveLabelParams({ owner, issue_number, repo }, issueLabels, filters))
        .then(issueRemoveLabelParams => issueRemoveLabelParams.forEach(value => issues.removeLabel(value)))
        .catch(reason => toolkit.log.error(reason));

      await listFiles(params)
        .then((response: Response<PullsListFilesResponse>) => response.data)
        .then((files: PullsListFilesResponseItem[]) => {
          toolkit.log.info('Checking files...', files.reduce((acc: string[], file: PullsListFilesResponseItem) => acc.concat(file.filename), []));
          return files;
        })
        .then((files: PullsListFilesResponseItem[]) => processListFilesResponses(files, filters))
        .then((eligibleFilters: Filter[]) => eligibleFilters.reduce((acc: string[], eligibleFilter: Filter) => acc.concat(eligibleFilter.labels), []))
        .then((labels: string[]) => {
          toolkit.log.info('Labels to add: ', labels);
          if (labels.length === 0) {
            toolkit.exit.neutral("No labels to add");
          }
          return { issue_number, labels, owner, repo };
        })
        .then((addLabelsParams: IssuesAddLabelsParams) => issues.addLabels(addLabelsParams))
        .then((value: Response<IssuesAddLabelsResponseItem[]>) => toolkit.log.info(`Adding label status: ${value.status}`))
        .catch(reason => toolkit.exit.failure(reason));
    }
    toolkit.exit.success('Labels were added to pull request')
  },
  args
);
