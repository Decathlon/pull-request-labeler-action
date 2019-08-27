import {
    IssuesAddLabelsParams,
    IssuesAddLabelsResponseItem,
    IssuesListLabelsOnIssueParams,
    IssuesListLabelsOnIssueResponse,
    PullsListFilesParams,
    PullsListFilesResponse,
    PullsListFilesResponseItem,
    Response
} from '@octokit/rest';
import {Toolkit, ToolkitOptions} from 'actions-toolkit';
// tslint:disable-next-line:no-submodule-imports
import {WebhookPayloadWithRepository} from 'actions-toolkit/lib/context';
// tslint:disable-next-line:no-submodule-imports
import {Exit} from 'actions-toolkit/lib/exit';
// tslint:disable-next-line:no-submodule-imports
import {GitHub} from 'actions-toolkit/lib/github';
import {LoggerFunc, Signale} from 'signale';
import {Filter, Repository} from './types';
import {
    buildIssueRemoveLabelParams,
    filterConfiguredIssueLabels,
    intersectLabels,
    processListFilesResponses
} from './utils';

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
const findIssueLabels = (issuesListLabelsOnIssueParams: IssuesListLabelsOnIssueParams, issues, filters: Filter[]): Promise<string[]> => {
    // Find issue labels that are configured in .github/label-pr.yml
    return issues.listLabelsOnIssue(issuesListLabelsOnIssueParams)
        .then(({data: labels}: Response<IssuesListLabelsOnIssueResponse>) => labels.reduce((acc, label) => acc.concat(label.name), []))
        .then(issueLabels => filterConfiguredIssueLabels(issueLabels, filters));
};

// Remove provided labels
const removeIssueLabels = (labels: string[], {log, exit}: Toolkit, repository: Repository, issues): void => {
    log.info('Labels to remove: ', labels);
    buildIssueRemoveLabelParams(repository, labels)
        .forEach(value => issues.removeLabel(value).catch(reason => exit.failure(reason)));
};

// Build labels to add
const getLabelsToAdd = (labels: string[], issueLabels: string[], {log, exit}: Toolkit): string[] => {
    const labelsToAdd: string[] = intersectLabels(labels, issueLabels);
    log.info('Labels to add: ', labelsToAdd);
    if (labelsToAdd.length === 0) {
        exit.neutral("No labels to add");
    }
    return labelsToAdd;
};

// Fetch all files (by recursively calling with page and per_page parameters)
const fetchAllFiles = (listFiles, log, params: PullsListFilesParams, per_page: number, page: number): Promise<PullsListFilesResponseItem[]> => {
    log.info(`Listing files (page: ${page} | per_page: ${per_page})...`);
    return listFiles({per_page, page, ...params})
        .then((response: Response<PullsListFilesResponse>) => {
            // If there may be other files to fetch
            log.info(`Loaded ${response.data.length} files`);
            let pullsListFilesResponseItems: PullsListFilesResponse = response.data;
            if (pullsListFilesResponseItems.length >= per_page) {
                return fetchAllFiles(listFiles, log, params, per_page, page + 1).then(value => value.concat(pullsListFilesResponseItems));
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
            const {pulls: {listFiles}, issues}: GitHub = toolkit.github;

            // First, we need to retrieve the existing issue labels and filter them over the configured one in config file
            const issueLabels: string[] = await findIssueLabels({issue_number, owner, repo}, issues, filters);

            const params: PullsListFilesParams = {owner, pull_number: issue_number, repo};

            await fetchAllFiles(listFiles, toolkit.log, params, 100, 1)
                .then((files: PullsListFilesResponseItem[]) => {
                    toolkit.log.info('Checking files...', files.reduce((acc: string[], file: PullsListFilesResponseItem) => acc.concat(file.filename), []));
                    return files;
                })
                .then((files: PullsListFilesResponseItem[]) => processListFilesResponses(files, filters))
                .then((eligibleFilters: Filter[]) => eligibleFilters.reduce((acc: string[], eligibleFilter: Filter) => acc.concat(eligibleFilter.labels), []))
                .then((labels: string[]) => {
                        removeIssueLabels(intersectLabels(issueLabels, labels), toolkit, {owner, issue_number, repo}, issues);
                        return {issue_number, labels: getLabelsToAdd(labels, issueLabels, toolkit), owner, repo};
                    }
                )
                .then((addLabelsParams: IssuesAddLabelsParams) => issues.addLabels(addLabelsParams))
                .catch(reason => toolkit.exit.failure(reason))
                .then((value: Response<IssuesAddLabelsResponseItem[]>) => toolkit.log.info(`Adding label status: ${value.status}`));
        }
        toolkit.exit.success('Labels were update into pull request')
    },
    args
);
