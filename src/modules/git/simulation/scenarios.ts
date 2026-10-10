/** Command scripts for the graph playground. Each is also run against real git to test the model. */
export interface GraphScenario {
  id: string
  title: string
  commands: string[]
}

export const GRAPH_SCENARIOS: readonly GraphScenario[] = [
  {
    id: 'fast-forward',
    title: 'Branch, commit, fast-forward merge',
    commands: ['git commit -m "Add app"', 'git switch -c feature', 'git commit -m "Add coupons"', 'git commit -m "Test coupons"', 'git switch main', 'git merge feature'],
  },
  {
    id: 'three-way',
    title: 'Both sides moved: a merge commit',
    commands: ['git commit -m "Add app"', 'git switch -c feature', 'git commit -m "Add invoices"', 'git switch main', 'git commit -m "Fix checkout"', 'git merge feature'],
  },
  {
    id: 'rebase',
    title: 'Rebase instead of merge',
    commands: ['git commit -m "Add app"', 'git switch -c feature', 'git commit -m "Add search"', 'git commit -m "Search by name"', 'git switch main', 'git commit -m "Fix checkout"', 'git switch feature', 'git rebase main', 'git switch main', 'git merge feature'],
  },
  {
    id: 'no-ff',
    title: 'Always a merge commit: --no-ff',
    commands: ['git commit -m "Add app"', 'git switch -c feature', 'git commit -m "Add footer"', 'git switch main', 'git merge --no-ff feature'],
  },
  {
    id: 'detached',
    title: 'Commits on a detached HEAD',
    commands: ['git commit -m "Add app"', 'git commit -m "Improve app"', 'git switch --detach HEAD~1', 'git commit -m "Experiment"', 'git switch main'],
  },
  {
    id: 'reset',
    title: 'reset --hard moves the branch back',
    commands: ['git commit -m "Add app"', 'git commit -m "Add cart"', 'git commit -m "Broken change"', 'git reset --hard HEAD~1'],
  },
  {
    id: 'cherry-pick',
    title: 'Cherry-pick a fix onto a release branch',
    commands: ['git commit -m "Add app"', 'git branch release', 'git commit -m "New feature"', 'git commit -m "Fix crash"', 'git switch release', 'git cherry-pick main'],
  },
  {
    id: 'delete',
    title: 'Deleting an unmerged branch',
    commands: ['git commit -m "Add app"', 'git switch -c spike', 'git commit -m "Spike"', 'git switch main', 'git branch -d spike', 'git branch -D spike'],
  },
]
