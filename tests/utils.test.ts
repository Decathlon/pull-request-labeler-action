// tslint:disable-next-line:no-implicit-dependencies
import { IssuesRemoveLabelParams, PullsListFilesResponseItem } from '@octokit/rest';
import { Filter, Repository } from '../src/types';
import { buildIssueRemoveLabelParams, filterConfiguredIssueLabels, intersectLabels, processListFilesResponses } from '../src/utils';

const IMAGE_REGEXP_AS_STRING: string = ".*\\.png+$";
const DOCUMENTATION_REGEXP_AS_STRING: string = ".*\\.md+$";
const IMAGES_FILTER: Filter = { labels: ["images"], regExp: IMAGE_REGEXP_AS_STRING };
const DOCUMENTATION_FILTER: Filter = { labels: ["documentation"], regExp: DOCUMENTATION_REGEXP_AS_STRING };
const ANY_FILTERS: Filter[] = [IMAGES_FILTER, DOCUMENTATION_FILTER];
const ANY_FILTERS_WITH_DUPLICATES: Filter[] = [{
  ...IMAGES_FILTER,
  labels: ["images", "documentation"]
}, DOCUMENTATION_FILTER];
const ANY_LABELS: string[] = ["images", "documentation"];
const ANY_OTHER_LABELS: string[] = ["critical", "bug"];

describe('File type regex checker', () => {
  it('should return true if regex fits', () => {
    expect(new RegExp(IMAGE_REGEXP_AS_STRING).test("whatever.png")).toBeTruthy();
  });
  it('should return false if regex does not fit', () => {
    expect(new RegExp(IMAGE_REGEXP_AS_STRING).test("whatever.md")).toBeFalsy();
  });
});

describe('processListFilesResponses', () => {
  const ANY_RESPONSE_ITEM: PullsListFilesResponseItem = {
    additions: 0,
    blob_url: "blob_url",
    changes: 0,
    contents_url: "contents_url",
    deletions: 0,
    filename: "filename",
    patch: "patch",
    raw_url: "raw_url",
    sha: "sha",
    status: "status"
  };
  const ANY_DOCUMENTATION_RESPONSE_ITEM: PullsListFilesResponseItem = {
    ...ANY_RESPONSE_ITEM,
    filename: "filename.md"
  };
  const ANY_OTHER_DOCUMENTATION_RESPONSE_ITEM: PullsListFilesResponseItem = {
    ...ANY_DOCUMENTATION_RESPONSE_ITEM,
    filename: "filename2.md"
  };

  const ANY_IMAGE_RESPONSE_ITEM: PullsListFilesResponseItem = {
    ...ANY_RESPONSE_ITEM,
    filename: "whatever.png"
  };

  it('should return an empty array if no filters are provided',
    () => expect(processListFilesResponses([ANY_RESPONSE_ITEM], [])).toEqual([]));

  it('should return an empty array if response has no data',
    () => expect(processListFilesResponses([], ANY_FILTERS)).toEqual([]));

  it('should return an empty array if none filename are defined in filters',
    () => expect(processListFilesResponses([ANY_RESPONSE_ITEM], ANY_FILTERS)).toEqual([]));

  it('should return an array with eligible filter if files are defined for provided filters',
    () => expect(processListFilesResponses([ANY_RESPONSE_ITEM, ANY_DOCUMENTATION_RESPONSE_ITEM], ANY_FILTERS)).toEqual([DOCUMENTATION_FILTER]));

  it('should return an array with all filters if multiple files are defined for provided filters',
    () => expect(processListFilesResponses([ANY_RESPONSE_ITEM, ANY_DOCUMENTATION_RESPONSE_ITEM, ANY_OTHER_DOCUMENTATION_RESPONSE_ITEM, ANY_IMAGE_RESPONSE_ITEM], ANY_FILTERS)).toEqual(ANY_FILTERS));
});

describe('filterConfiguredIssueLabels', () => {
  it('should return empty list when no filters',
    () => expect(filterConfiguredIssueLabels(ANY_LABELS, [])).toStrictEqual([]));

  it('should return full list of filters if no labels',
    () => expect(filterConfiguredIssueLabels([], ANY_FILTERS)).toStrictEqual([]));

  it('should return empty list if none of the labels are in filters',
    () => expect(filterConfiguredIssueLabels(ANY_OTHER_LABELS, ANY_FILTERS)).toStrictEqual([]));

  it('should return labels that are common with filters',
    () => expect(filterConfiguredIssueLabels(ANY_LABELS, ANY_FILTERS)).toStrictEqual(ANY_LABELS));

  it('should return labels that are common with filters but with distinct',
    () => expect(filterConfiguredIssueLabels(ANY_LABELS, ANY_FILTERS_WITH_DUPLICATES)).toStrictEqual(ANY_LABELS));
});

describe('buildIssueRemoveLabelParams', () => {
  const ANY_REPOSITORY: Repository = {
    issue_number: 123,
    owner: "repository_owner",
    repo: "repository_name"
  };
  const DOCUMENTATION_REMOVE_LABEL_PARAM: IssuesRemoveLabelParams = {
    issue_number: ANY_REPOSITORY.issue_number,
    name: "documentation",
    owner: ANY_REPOSITORY.owner,
    repo: ANY_REPOSITORY.repo
  };

  it('should return an empty list if no labels are provided',
    () => expect(buildIssueRemoveLabelParams(ANY_REPOSITORY, [])).toEqual([]));

  it('should return labelParams with provided repository and labels', () => {
    const expected: IssuesRemoveLabelParams[] = [{
      ...DOCUMENTATION_REMOVE_LABEL_PARAM,
      name: "images"
    }, DOCUMENTATION_REMOVE_LABEL_PARAM];
    expect(buildIssueRemoveLabelParams(ANY_REPOSITORY, ANY_LABELS)).toEqual(expected);
  });
});

describe('intersectLabels', () => {
  it('should return an empty list when providing list are both empty',
    () => expect(intersectLabels([], [])).toEqual([]));

  it('should return an empty list when providing list is empty and standard is not',
    () => expect(intersectLabels([], ANY_LABELS)).toEqual([]));

  it('should return provided list of labels when providing an empty standard list',
    () => expect(intersectLabels(ANY_LABELS, [])).toEqual(ANY_LABELS));

  it('should return an empty list when providing both identical list',
    () => expect(intersectLabels(ANY_LABELS, ANY_LABELS)).toEqual([]));

  it('should return provided list of labels when none of the standard list match',
    () => expect(intersectLabels(ANY_LABELS, ANY_OTHER_LABELS)).toEqual(ANY_LABELS));

  it('should return an intersection of both list of labels when some matches',
    () => expect(intersectLabels(ANY_LABELS, ANY_OTHER_LABELS.concat("documentation"))).toEqual(["images"]));
});
