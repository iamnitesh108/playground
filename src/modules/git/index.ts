import type { LearningModule } from '@/core/module'

export const gitModule: LearningModule = {
  id: 'git',
  title: 'Git, from zero to confident',
  description:
    'Version control with Git, recorded from a real Git: setup, the three areas, history, how Git stores data, branches, merging and rebasing, remotes, work and personal accounts on one machine, undoing anything, and the everyday toolbox.',
  tags: ['git', 'version control', 'branching', 'ssh', 'collaboration'],
  groups: [
    {
      title: 'Getting started',
      lessons: [
        { slug: 'setup', title: 'Install and configure Git', summary: 'What Git is, installing it, your identity, and the three configuration levels.', load: () => import('./lessons/Setup') },
        { slug: 'areas', title: 'Working tree, staging area, commits', summary: 'The three places a change lives, and status, add, diff, restore and commit.', load: () => import('./lessons/Areas') },
        { slug: 'history', title: 'Reading history', summary: 'log in all its forms, show, diff between commits, blame — finding who changed what and why.', load: () => import('./lessons/History') },
        { slug: 'internals', title: 'How Git stores your work', summary: 'Blobs, trees and commits inside .git — and why a branch is just a file with a hash.', load: () => import('./lessons/Internals') },
      ],
    },
    {
      title: 'Branching',
      lessons: [
        { slug: 'branches', title: 'Branches and HEAD', summary: 'Creating and switching branches, detached HEAD, deleting — on an interactive commit graph.', load: () => import('./lessons/Branches') },
        { slug: 'merging', title: 'Merging and conflicts', summary: 'Fast-forward and three-way merges, resolving a real conflict, and aborting.', load: () => import('./lessons/Merging') },
        { slug: 'rebase', title: 'Rebase and cherry-pick', summary: 'Replaying commits, cleaning up history with interactive rebase, and the one rule that keeps it safe.', load: () => import('./lessons/Rebase') },
      ],
    },
    {
      title: 'Working with others',
      lessons: [
        { slug: 'remotes', title: 'Remotes: clone, fetch, pull, push', summary: 'Sharing a repository, tracking branches, rejected pushes, and pulling with rebase.', load: () => import('./lessons/Remotes') },
        { slug: 'accounts', title: 'Work and personal accounts on one machine', summary: 'SSH keys per account, host aliases, identity by folder or by remote, and signed commits.', load: () => import('./lessons/Accounts') },
        { slug: 'workflow', title: 'Team workflow', summary: 'Feature branches and pull requests, good commit messages, .gitignore, hooks and aliases.', load: () => import('./lessons/Workflow') },
      ],
    },
    {
      title: 'Fixing and finding things',
      lessons: [
        { slug: 'undo', title: 'Undoing anything', summary: 'amend, reset (soft, mixed, hard), revert, restore — and getting “lost” work back with the reflog.', load: () => import('./lessons/Undo') },
        { slug: 'toolbox', title: 'Stash, tags, worktrees and bisect', summary: 'Parking work, marking releases, two branches at once, and finding the commit that broke something.', load: () => import('./lessons/Toolbox') },
        { slug: 'reference', title: 'Command reference', summary: 'The commands you will use every week, grouped and searchable, with examples.', load: () => import('./lessons/Reference') },
      ],
    },
  ],
}
