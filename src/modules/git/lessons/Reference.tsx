import { LessonGoals } from '@/shared/ui'
import { CommandReference, type CommandEntry } from '../components'

const COMMANDS: CommandEntry[] = [
  { group: 'Setup', command: 'git config --global user.name "Ann Lee"', does: 'set your name for all repositories', lesson: 'setup' },
  { group: 'Setup', command: 'git config --global user.email "ann@example.com"', does: 'set your email for all repositories', lesson: 'setup' },
  { group: 'Setup', command: 'git config --global init.defaultBranch main', does: 'name the first branch of new repositories main', lesson: 'setup' },
  { group: 'Setup', command: 'git config --show-origin user.email', does: 'show a value and the file it comes from', lesson: 'setup' },
  { group: 'Setup', command: 'git init', does: 'turn the current folder into a repository', lesson: 'setup' },
  { group: 'Setup', command: 'git clone <url> [folder]', does: 'copy a repository, with its full history', lesson: 'remotes' },

  { group: 'Everyday', command: 'git status  /  git status -s', does: 'what is changed, staged, untracked', lesson: 'areas' },
  { group: 'Everyday', command: 'git add <file>  /  git add -p', does: 'stage a file / stage changes piece by piece', lesson: 'areas' },
  { group: 'Everyday', command: 'git diff  /  git diff --staged', does: 'unstaged changes / what the next commit contains', lesson: 'areas' },
  { group: 'Everyday', command: 'git commit -m "Add cart total"', does: 'commit the staging area', lesson: 'areas' },
  { group: 'Everyday', command: 'git restore --staged <file>', does: 'unstage, keep the edits', lesson: 'areas' },
  { group: 'Everyday', command: 'git restore <file>', does: 'discard edits to a file (permanent)', lesson: 'areas' },
  { group: 'Everyday', command: 'git rm --cached <file>', does: 'stop tracking a file but keep it on disk', lesson: 'workflow' },
  { group: 'Everyday', command: 'git mv <old> <new>', does: 'rename a file and stage the rename' },

  { group: 'History', command: 'git log --oneline --graph --all', does: 'overview of all branches', lesson: 'history' },
  { group: 'History', command: 'git show <commit>', does: 'a commit with its diff', lesson: 'history' },
  { group: 'History', command: 'git log -S"text"', does: 'commits that added or removed text in the code', lesson: 'history' },
  { group: 'History', command: 'git log --author="Bob" -- <path>', does: 'commits by an author that touched a path', lesson: 'history' },
  { group: 'History', command: 'git log main..feature', does: 'commits on feature that main does not have', lesson: 'history' },
  { group: 'History', command: 'git blame <file>', does: 'last commit that changed each line', lesson: 'history' },
  { group: 'History', command: 'git diff main...feature', does: 'changes on feature since it branched off main' },

  { group: 'Branches', command: 'git switch -c <name>', does: 'create a branch and switch to it', lesson: 'branches' },
  { group: 'Branches', command: 'git switch <name>  /  git switch -', does: 'switch to a branch / to the previous one', lesson: 'branches' },
  { group: 'Branches', command: 'git branch -vv', does: 'branches with last commit and upstream', lesson: 'branches' },
  { group: 'Branches', command: 'git branch -d <name>  /  -D', does: 'delete a merged branch / any branch', lesson: 'branches' },
  { group: 'Branches', command: 'git merge <branch>', does: 'bring another branch into the current one', lesson: 'merging' },
  { group: 'Branches', command: 'git merge --abort', does: 'give up a merge with conflicts', lesson: 'merging' },
  { group: 'Branches', command: 'git rebase main', does: 'replay your commits on top of main', lesson: 'rebase' },
  { group: 'Branches', command: 'git rebase -i HEAD~3', does: 'reorder, squash, reword or drop recent commits', lesson: 'rebase' },
  { group: 'Branches', command: 'git rebase --continue  /  --abort', does: 'after resolving a conflict / give up', lesson: 'rebase' },
  { group: 'Branches', command: 'git cherry-pick <commit>', does: 'copy one commit onto the current branch', lesson: 'rebase' },

  { group: 'Remotes', command: 'git remote -v', does: 'list remotes and their URLs', lesson: 'remotes' },
  { group: 'Remotes', command: 'git remote add origin <url>', does: 'connect a repository to a remote', lesson: 'remotes' },
  { group: 'Remotes', command: 'git remote set-url origin <url>', does: 'change a remote URL (e.g. to an SSH alias)', lesson: 'accounts' },
  { group: 'Remotes', command: 'git fetch  /  git fetch --prune', does: 'download, and drop deleted remote branches', lesson: 'remotes' },
  { group: 'Remotes', command: 'git pull --rebase', does: 'fetch and replay your commits on top', lesson: 'remotes' },
  { group: 'Remotes', command: 'git push -u origin <branch>', does: 'publish a branch and track it', lesson: 'remotes' },
  { group: 'Remotes', command: 'git push --force-with-lease', does: 'overwrite your rewritten branch, unless someone else pushed', lesson: 'remotes' },
  { group: 'Remotes', command: 'git push origin --delete <branch>', does: 'delete a branch on the remote', lesson: 'remotes' },

  { group: 'Accounts', command: 'ssh-keygen -t ed25519 -C "you@example.com" -f ~/.ssh/id_ed25519_work', does: 'create a key for one account', lesson: 'accounts' },
  { group: 'Accounts', command: 'ssh -T git@github.com-work', does: 'test which account an alias logs in as', lesson: 'accounts' },
  { group: 'Accounts', command: 'ssh -G github.com-work', does: 'show the settings SSH will use for an alias', lesson: 'accounts' },
  { group: 'Accounts', command: 'git var GIT_AUTHOR_IDENT', does: 'the name and email the next commit will use', lesson: 'accounts' },
  { group: 'Accounts', command: 'git commit --amend --reset-author --no-edit', does: 'fix the author of the last commit', lesson: 'accounts' },

  { group: 'Undo', command: 'git commit --amend', does: 'replace the last commit (not pushed yet)', lesson: 'undo' },
  { group: 'Undo', command: 'git reset --soft HEAD~1', does: 'undo the last commit, keep changes staged', lesson: 'undo' },
  { group: 'Undo', command: 'git reset HEAD~1', does: 'undo the last commit, keep changes unstaged', lesson: 'undo' },
  { group: 'Undo', command: 'git reset --hard HEAD~1', does: 'throw the last commit and uncommitted changes away', lesson: 'undo' },
  { group: 'Undo', command: 'git revert <commit>', does: 'new commit that undoes a pushed commit', lesson: 'undo' },
  { group: 'Undo', command: 'git reflog', does: 'everywhere HEAD has been — find lost commits', lesson: 'undo' },
  { group: 'Undo', command: 'git restore --source=<commit> <file>', does: 'get a file back from a commit', lesson: 'undo' },

  { group: 'Toolbox', command: 'git stash push -u -m "…"  /  git stash pop', does: 'park changes / bring them back', lesson: 'toolbox' },
  { group: 'Toolbox', command: 'git tag -a v1.0.0 -m "…"', does: 'annotated release tag', lesson: 'toolbox' },
  { group: 'Toolbox', command: 'git push origin v1.0.0', does: 'publish a tag', lesson: 'toolbox' },
  { group: 'Toolbox', command: 'git clean -n -d  /  -f -d', does: 'preview / delete untracked files', lesson: 'toolbox' },
  { group: 'Toolbox', command: 'git worktree add ../hotfix -b hotfix/x', does: 'a second working folder on another branch', lesson: 'toolbox' },
  { group: 'Toolbox', command: 'git bisect start <bad> <good>  /  git bisect run ./test.sh', does: 'find the commit that broke something', lesson: 'toolbox' },
  { group: 'Toolbox', command: 'git check-ignore -v <file>', does: 'which .gitignore rule ignores a file', lesson: 'workflow' },
]

export default function Reference() {
  return (
    <>
      <LessonGoals goals={['find the right command quickly, with the lesson that explains it']} />
      <p>The commands from this module that you will use most, grouped. Type to filter; follow “lesson” for recorded examples and explanations.</p>
      <CommandReference entries={COMMANDS} />
    </>
  )
}
