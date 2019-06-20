export interface Repository {
  owner: string;
  repo: string;
  issue_number: number;
}

export interface Filter {
  regExp: string;
  labels: string[];
}
