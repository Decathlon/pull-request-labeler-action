import { IssuesRemoveLabelParams, PullsListFilesResponseItem } from '@octokit/rest';
import { Filter, Repository } from './types';

// Process the list of files being committed to return the list of eligible filters (whose filename matches their regExp)
export const processListFilesResponses = (files: PullsListFilesResponseItem[], filters: Filter[]): Filter[] =>
  filters.filter(filter => files.find(file => new RegExp(filter.regExp).test(file.filename)));

// Filter the list of provided labels to return those that are part of provided filters
export const getLabelsToRemove = (labels: string[], filters: Filter[]): string[] => {
  const configuredLabels: string[] = filters.reduce((acc: string[], filter: Filter) => acc.concat(filter.labels), []);
  // To filter and have a distinct list of labels to remove
  return [...new Set(configuredLabels.filter(label => labels.includes(label)))];
};

// Build a list of IssueRemoveLabelParams from the list of provided labels
export const buildIssueRemoveLabelParams = ({ repo, issue_number, owner }: Repository, labels: string[], filters: Filter[]): IssuesRemoveLabelParams[] => {
  return getLabelsToRemove(labels, filters).map(label => ({
    issue_number,
    name: label,
    owner,
    repo
  }));
};
