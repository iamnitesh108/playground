// Recorded with git 2.54.0 in a sandboxed home directory by tools/git-capture — do not edit by hand.

export const CAPTURE = {
 "git": "2.54.0",
 "setup": {
  "fresh": [
   {
    "cmd": "git config --global --list",
    "out": "fatal: unable to read config file '/home/ann/.gitconfig': No such file or directory",
    "exit": 128
   },
   {
    "cmd": "git init first-repo",
    "out": "hint: Using 'master' as the name for the initial branch. This default branch name\nhint: will change to \"main\" in Git 3.0. To configure the initial branch name\nhint: to use in all of your new repositories, which will suppress this warning,\nhint: call:\nhint:\nhint: \tgit config --global init.defaultBranch <name>\nhint:\nhint: Names commonly chosen instead of 'master' are 'main', 'trunk' and\nhint: 'development'. The just-created branch can be renamed via this command:\nhint:\nhint: \tgit branch -m <name>\nhint:\nhint: Disable this message with \"git config set advice.defaultBranchName false\"\nInitialized empty Git repository in /home/ann/first-repo/.git/",
    "exit": 0
   }
  ],
  "identity": [
   {
    "cmd": "git config --global user.name \"Ann Lee\"",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git config --global user.email \"ann@example.com\"",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git config --global init.defaultBranch main",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git config --global core.editor \"nano\"",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git config --global pull.rebase true",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git config --global --list --show-origin",
    "out": "file:/home/ann/.gitconfig\tuser.name=Ann Lee\nfile:/home/ann/.gitconfig\tuser.email=ann@example.com\nfile:/home/ann/.gitconfig\tinit.defaultbranch=main\nfile:/home/ann/.gitconfig\tcore.editor=nano\nfile:/home/ann/.gitconfig\tpull.rebase=true",
    "exit": 0
   },
   {
    "cmd": "cat ~/.gitconfig",
    "out": "[user]\n\tname = Ann Lee\n\temail = ann@example.com\n[init]\n\tdefaultBranch = main\n[core]\n\teditor = nano\n[pull]\n\trebase = true",
    "exit": 0
   }
  ],
  "levels": [
   {
    "cmd": "git config --show-scope --show-origin --get-all user.email",
    "out": "global\tfile:/home/ann/.gitconfig\tann@example.com\nlocal\tfile:.git/config\tann@shop.example",
    "exit": 0
   },
   {
    "cmd": "git config user.email",
    "out": "ann@shop.example",
    "exit": 0
   },
   {
    "cmd": "git config --show-scope --show-origin user.name",
    "out": "global\tfile:/home/ann/.gitconfig\tAnn Lee",
    "exit": 0
   }
  ],
  "extras": [
   {
    "cmd": "git config --global core.autocrlf input",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "cat ~/.config/git/ignore",
    "out": ".DS_Store\n.idea/\n*.swp",
    "exit": 0
   },
   {
    "cmd": "git --version",
    "out": "git version 2.54.0",
    "exit": 0
   }
  ]
 },
 "objects": {
  "empty": [
   {
    "cmd": "ls -A .git",
    "out": "config\ndescription\nHEAD\nhooks\ninfo\nobjects\nrefs",
    "exit": 0
   },
   {
    "cmd": "cat .git/HEAD",
    "out": "ref: refs/heads/main",
    "exit": 0
   },
   {
    "cmd": "find .git/objects -type f",
    "out": "",
    "exit": 0
   }
  ],
  "commit": [
   {
    "cmd": "git log --oneline",
    "out": "f8805c1 (HEAD -> main) Add readme and app",
    "exit": 0
   },
   {
    "cmd": "cat .git/refs/heads/main",
    "out": "f8805c167e850173c32c8c84830c06a736d1ffd7",
    "exit": 0
   },
   {
    "cmd": "git cat-file -t HEAD",
    "out": "commit",
    "exit": 0
   },
   {
    "cmd": "git cat-file -p HEAD",
    "out": "tree a0d29a87174d060719138899e3c49e2f659ddae2\nauthor Ann Lee <ann@example.com> 1791191280 +0000\ncommitter Ann Lee <ann@example.com> 1791191280 +0000\n\nAdd readme and app",
    "exit": 0
   },
   {
    "cmd": "git cat-file -p HEAD^{tree}",
    "out": "100644 blob a00621bb3a9b990ee018f8d04c2d3140800d6ca6\tREADME.md\n040000 tree 27b65ab8cc727e0a7e037d93b120514739a3f8d3\tsrc",
    "exit": 0
   },
   {
    "cmd": "git cat-file -p HEAD:src",
    "out": "100644 blob 371fdfb152a2c9af90c33b84016cc6dc56c89a43\tapp.js",
    "exit": 0
   },
   {
    "cmd": "git cat-file -p HEAD:README.md",
    "out": "# Shop",
    "exit": 0
   },
   {
    "cmd": "find .git/objects -type f | sort",
    "out": ".git/objects/27/b65ab8cc727e0a7e037d93b120514739a3f8d3\n.git/objects/37/1fdfb152a2c9af90c33b84016cc6dc56c89a43\n.git/objects/a0/0621bb3a9b990ee018f8d04c2d3140800d6ca6\n.git/objects/a0/d29a87174d060719138899e3c49e2f659ddae2\n.git/objects/f8/805c167e850173c32c8c84830c06a736d1ffd7",
    "exit": 0
   }
  ],
  "hash": [
   {
    "cmd": "git hash-object README.md docs/README-copy.md",
    "out": "a00621bb3a9b990ee018f8d04c2d3140800d6ca6\na00621bb3a9b990ee018f8d04c2d3140800d6ca6",
    "exit": 0
   },
   {
    "cmd": "echo \"# Shop\" | git hash-object --stdin",
    "out": "a00621bb3a9b990ee018f8d04c2d3140800d6ca6",
    "exit": 0
   }
  ],
  "second": [
   {
    "cmd": "git cat-file -p HEAD",
    "out": "tree bbbb506fd180f5b7723dc7b00bd53da65d8e2131\nparent f8805c167e850173c32c8c84830c06a736d1ffd7\nauthor Ann Lee <ann@example.com> 1791191940 +0000\ncommitter Ann Lee <ann@example.com> 1791191940 +0000\n\nDescribe the shop",
    "exit": 0
   },
   {
    "cmd": "git cat-file -p HEAD^{tree}",
    "out": "100644 blob d52afdf6df1919d00b071636fd8bfa5a9106d522\tREADME.md\n040000 tree 27b65ab8cc727e0a7e037d93b120514739a3f8d3\tsrc",
    "exit": 0
   }
  ]
 },
 "areas": [
  {
   "label": "clean",
   "steps": [
    {
     "cmd": "git status",
     "out": "On branch main\nnothing to commit, working tree clean",
     "exit": 0
    }
   ]
  },
  {
   "label": "untracked",
   "steps": [
    {
     "cmd": "git status",
     "out": "On branch main\nUntracked files:\n  (use \"git add <file>...\" to include in what will be committed)\n\tcart.js\n\nnothing added to commit but untracked files present (use \"git add\" to track)",
     "exit": 0
    },
    {
     "cmd": "git status --short",
     "out": "?? cart.js",
     "exit": 0
    }
   ]
  },
  {
   "label": "stage",
   "steps": [
    {
     "cmd": "git add cart.js",
     "out": "",
     "exit": 0
    },
    {
     "cmd": "git status --short",
     "out": "A  cart.js",
     "exit": 0
    }
   ]
  },
  {
   "label": "modified",
   "steps": [
    {
     "cmd": "git status",
     "out": "On branch main\nChanges to be committed:\n  (use \"git restore --staged <file>...\" to unstage)\n\tnew file:   cart.js\n\nChanges not staged for commit:\n  (use \"git add <file>...\" to update what will be committed)\n  (use \"git restore <file>...\" to discard changes in working directory)\n\tmodified:   app.js",
     "exit": 0
    },
    {
     "cmd": "git diff",
     "out": "diff --git a/app.js b/app.js\nindex cc4f1ea..c5aa63c 100644\n--- a/app.js\n+++ b/app.js\n@@ -1 +1,2 @@\n const total = 0\n+const tax = 0.2",
     "exit": 0
    }
   ]
  },
  {
   "label": "staged-and-modified",
   "steps": [
    {
     "cmd": "git add app.js",
     "out": "",
     "exit": 0
    },
    {
     "cmd": "git status --short",
     "out": "M  app.js\nA  cart.js",
     "exit": 0
    }
   ]
  },
  {
   "label": "both",
   "steps": [
    {
     "cmd": "git status --short",
     "out": "MM app.js\nA  cart.js",
     "exit": 0
    },
    {
     "cmd": "git diff",
     "out": "diff --git a/app.js b/app.js\nindex c5aa63c..81123b0 100644\n--- a/app.js\n+++ b/app.js\n@@ -1,2 +1,3 @@\n const total = 0\n const tax = 0.2\n+const currency = 'EUR'",
     "exit": 0
    },
    {
     "cmd": "git diff --staged",
     "out": "diff --git a/app.js b/app.js\nindex cc4f1ea..c5aa63c 100644\n--- a/app.js\n+++ b/app.js\n@@ -1 +1,2 @@\n const total = 0\n+const tax = 0.2\ndiff --git a/cart.js b/cart.js\nnew file mode 100644\nindex 0000000..6972ec5\n--- /dev/null\n+++ b/cart.js\n@@ -0,0 +1 @@\n+export const items = []",
     "exit": 0
    }
   ]
  },
  {
   "label": "unstage",
   "steps": [
    {
     "cmd": "git restore --staged app.js",
     "out": "",
     "exit": 0
    },
    {
     "cmd": "git status --short",
     "out": " M app.js\nA  cart.js",
     "exit": 0
    }
   ]
  },
  {
   "label": "discard",
   "steps": [
    {
     "cmd": "git restore app.js",
     "out": "",
     "exit": 0
    },
    {
     "cmd": "git status --short",
     "out": "A  cart.js",
     "exit": 0
    },
    {
     "cmd": "cat app.js",
     "out": "const total = 0",
     "exit": 0
    }
   ]
  },
  {
   "label": "commit",
   "steps": [
    {
     "cmd": "git commit -m \"Add cart\"",
     "out": "[main 6763e6c] Add cart\n 1 file changed, 1 insertion(+)\n create mode 100644 cart.js",
     "exit": 0
    },
    {
     "cmd": "git status",
     "out": "On branch main\nnothing to commit, working tree clean",
     "exit": 0
    }
   ]
  }
 ],
 "history": {
  "log": [
   {
    "cmd": "git log",
    "out": "commit 59980cf08758b6656f78ae3bc5578e1f63286fd9 (HEAD -> main)\nAuthor: Ann Lee <ann@example.com>\nDate:   Mon Oct 5 09:10:00 2026 +0000\n\n    Compute the cart total\n\ncommit 3dc32e49b5e2751154713609ad87fb77bd706aa3\nAuthor: Bob Kim <bob@example.com>\nDate:   Mon Oct 5 09:08:00 2026 +0000\n\n    Add payment call\n\ncommit e9198ac3f1e096b1e1a4fd6d9885ceabcaa494a5\nAuthor: Ann Lee <ann@example.com>\nDate:   Mon Oct 5 09:06:00 2026 +0000\n\n    Add items to the cart\n\ncommit 172cbe04002addd9d016b8062a7ea6befa39241a\nAuthor: Ann Lee <ann@example.com>\nDate:   Mon Oct 5 09:05:00 2026 +0000\n\n    Add cart",
    "exit": 0
   }
  ],
  "oneline": [
   {
    "cmd": "git log --oneline",
    "out": "59980cf (HEAD -> main) Compute the cart total\n3dc32e4 Add payment call\ne9198ac Add items to the cart\n172cbe0 Add cart",
    "exit": 0
   },
   {
    "cmd": "git log --oneline -2",
    "out": "59980cf (HEAD -> main) Compute the cart total\n3dc32e4 Add payment call",
    "exit": 0
   }
  ],
  "stat": [
   {
    "cmd": "git log --stat -1",
    "out": "commit 59980cf08758b6656f78ae3bc5578e1f63286fd9 (HEAD -> main)\nAuthor: Ann Lee <ann@example.com>\nDate:   Mon Oct 5 09:10:00 2026 +0000\n\n    Compute the cart total\n\n cart.js | 1 +\n 1 file changed, 1 insertion(+)",
    "exit": 0
   }
  ],
  "patch": [
   {
    "cmd": "git show HEAD",
    "out": "commit 59980cf08758b6656f78ae3bc5578e1f63286fd9 (HEAD -> main)\nAuthor: Ann Lee <ann@example.com>\nDate:   Mon Oct 5 09:10:00 2026 +0000\n\n    Compute the cart total\n\ndiff --git a/cart.js b/cart.js\nindex 2d0634c..975c95f 100644\n--- a/cart.js\n+++ b/cart.js\n@@ -1,2 +1,3 @@\n export const items = []\n export const add = (item) => items.push(item)\n+export const total = () => items.reduce((s, i) => s + i.price, 0)",
    "exit": 0
   }
  ],
  "filters": [
   {
    "cmd": "git log --oneline --author=\"Bob\"",
    "out": "3dc32e4 Add payment call",
    "exit": 0
   },
   {
    "cmd": "git log --oneline -- pay.js",
    "out": "3dc32e4 Add payment call",
    "exit": 0
   },
   {
    "cmd": "git log --oneline -S\"reduce\"",
    "out": "59980cf (HEAD -> main) Compute the cart total",
    "exit": 0
   },
   {
    "cmd": "git log --format=\"%h %an %ar %s\"",
    "out": "59980cf Ann Lee 5 days ago Compute the cart total\n3dc32e4 Bob Kim 5 days ago Add payment call\ne9198ac Ann Lee 5 days ago Add items to the cart\n172cbe0 Ann Lee 5 days ago Add cart",
    "exit": 0
   }
  ],
  "refs": [
   {
    "cmd": "git show --stat --format=\"%h %s\" HEAD~2",
    "out": "e9198ac Add items to the cart\n\n cart.js | 1 +\n 1 file changed, 1 insertion(+)",
    "exit": 0
   },
   {
    "cmd": "git diff HEAD~3 HEAD --stat",
    "out": " cart.js | 2 ++\n pay.js  | 3 +++\n 2 files changed, 5 insertions(+)",
    "exit": 0
   }
  ],
  "blame": [
   {
    "cmd": "git blame cart.js",
    "out": "^172cbe0 (Ann Lee 2026-10-05 09:05:00 +0000 1) export const items = []\ne9198ac3 (Ann Lee 2026-10-05 09:06:00 +0000 2) export const add = (item) => items.push(item)\n59980cf0 (Ann Lee 2026-10-05 09:10:00 +0000 3) export const total = () => items.reduce((s, i) => s + i.price, 0)",
    "exit": 0
   }
  ]
 },
 "branches": {
  "create": [
   {
    "cmd": "git branch feature/coupons",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git branch",
    "out": "  feature/coupons\n* main",
    "exit": 0
   },
   {
    "cmd": "cat .git/refs/heads/feature/coupons",
    "out": "0495a590f246f2dd58de904bd156cb00aab2eedf",
    "exit": 0
   },
   {
    "cmd": "cat .git/HEAD",
    "out": "ref: refs/heads/main",
    "exit": 0
   }
  ],
  "switch": [
   {
    "cmd": "git switch feature/coupons",
    "out": "Switched to branch 'feature/coupons'",
    "exit": 0
   },
   {
    "cmd": "cat .git/HEAD",
    "out": "ref: refs/heads/feature/coupons",
    "exit": 0
   },
   {
    "cmd": "git add coupons.js && git commit -m \"Add coupons\"",
    "out": "[feature/coupons 2028c64] Add coupons\n 1 file changed, 1 insertion(+)\n create mode 100644 coupons.js",
    "exit": 0
   },
   {
    "cmd": "git branch -v",
    "out": "* feature/coupons 2028c64 Add coupons\n  main            0495a59 Improve app",
    "exit": 0
   }
  ],
  "graph": [
   {
    "cmd": "git switch main",
    "out": "Switched to branch 'main'",
    "exit": 0
   },
   {
    "cmd": "git commit -am \"Fix rounding\"",
    "out": "[main 7f4ab3d] Fix rounding\n 1 file changed, 1 insertion(+), 1 deletion(-)",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* 7f4ab3d (HEAD -> main) Fix rounding\n| * 2028c64 (feature/coupons) Add coupons\n|/  \n* 0495a59 Improve app\n* b829903 Add app",
    "exit": 0
   }
  ],
  "newBranch": [
   {
    "cmd": "git switch -c fix/typo",
    "out": "Switched to a new branch 'fix/typo'",
    "exit": 0
   },
   {
    "cmd": "git switch -",
    "out": "Switched to branch 'main'",
    "exit": 0
   }
  ],
  "detached": [
   {
    "cmd": "git switch --detach HEAD~1",
    "out": "HEAD is now at 0495a59 Improve app",
    "exit": 0
   },
   {
    "cmd": "git status",
    "out": "HEAD detached at 0495a59\nnothing to commit, working tree clean",
    "exit": 0
   },
   {
    "cmd": "git switch main",
    "out": "Previous HEAD position was 0495a59 Improve app\nSwitched to branch 'main'",
    "exit": 0
   }
  ],
  "delete": [
   {
    "cmd": "git branch -d feature/coupons",
    "out": "error: the branch 'feature/coupons' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D feature/coupons'\nhint: Disable this message with \"git config set advice.forceDeleteBranch false\"",
    "exit": 1
   },
   {
    "cmd": "git branch -d fix/typo",
    "out": "Deleted branch fix/typo (was 7f4ab3d).",
    "exit": 0
   },
   {
    "cmd": "git branch -m feature/coupons feature/discounts",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git branch",
    "out": "  feature/discounts\n* main",
    "exit": 0
   }
  ]
 },
 "merging": {
  "fastForward": [
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* e326ce7 (feature/coupons) Add coupons\n* 6c5cc2d (HEAD -> main) Add price helpers",
    "exit": 0
   },
   {
    "cmd": "git merge feature/coupons",
    "out": "Updating 6c5cc2d..e326ce7\nFast-forward\n coupons.js | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 coupons.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* e326ce7 (HEAD -> main, feature/coupons) Add coupons\n* 6c5cc2d Add price helpers",
    "exit": 0
   }
  ],
  "threeWay": [
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* 48d20a6 (HEAD -> main) Add readme\n| * 9a0d298 (feature/invoices) Add invoice numbers\n|/  \n* e326ce7 (feature/coupons) Add coupons\n* 6c5cc2d Add price helpers",
    "exit": 0
   },
   {
    "cmd": "git merge feature/invoices -m \"Merge branch 'feature/invoices'\"",
    "out": "Merge made by the 'ort' strategy.\n invoice.js | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 invoice.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph --all",
    "out": "*   6d10898 (HEAD -> main) Merge branch 'feature/invoices'\n|\\  \n| * 9a0d298 (feature/invoices) Add invoice numbers\n* | 48d20a6 Add readme\n|/  \n* e326ce7 (feature/coupons) Add coupons\n* 6c5cc2d Add price helpers",
    "exit": 0
   },
   {
    "cmd": "git cat-file -p HEAD",
    "out": "tree 2983ea9723e393a833065d819cce565b65174cac\nparent 48d20a6cf20ee22b6331fd020f8e71a02730bd7e\nparent 9a0d298f00bd57543f323a59697912c44b340095\nauthor Ann Lee <ann@example.com> 1791191820 +0000\ncommitter Ann Lee <ann@example.com> 1791191820 +0000\n\nMerge branch 'feature/invoices'",
    "exit": 0
   }
  ],
  "conflict": [
   {
    "cmd": "git merge feature/vat",
    "out": "Auto-merging price.js\nCONFLICT (content): Merge conflict in price.js\nAutomatic merge failed; fix conflicts and then commit the result.",
    "exit": 1
   },
   {
    "cmd": "git status",
    "out": "On branch main\nYou have unmerged paths.\n  (fix conflicts and run \"git commit\")\n  (use \"git merge --abort\" to abort the merge)\n\nUnmerged paths:\n  (use \"git add <file>...\" to mark resolution)\n\tboth modified:   price.js\n\nno changes added to commit (use \"git add\" and/or \"git commit -a\")",
    "exit": 0
   },
   {
    "cmd": "cat price.js",
    "out": "<<<<<<< HEAD\nexport const VAT = 0.19\n=======\nexport const VAT = 0.21\n>>>>>>> feature/vat\nexport const round = (x) => Math.round(x * 100) / 100",
    "exit": 0
   },
   {
    "cmd": "git diff",
    "out": "diff --cc price.js\nindex f22686a,56388d9..0000000\n--- a/price.js\n+++ b/price.js\n@@@ -1,2 -1,2 +1,6 @@@\n++<<<<<<< HEAD\n +export const VAT = 0.19\n++=======\n+ export const VAT = 0.21\n++>>>>>>> feature/vat\n  export const round = (x) => Math.round(x * 100) / 100",
    "exit": 0
   }
  ],
  "resolve": [
   {
    "cmd": "cat price.js",
    "out": "export const VAT = 0.21\nexport const round = (x) => Math.round(x * 100) / 100",
    "exit": 0
   },
   {
    "cmd": "git add price.js",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": "M  price.js",
    "exit": 0
   },
   {
    "cmd": "git commit --no-edit",
    "out": "[main e7978f4] Merge branch 'feature/vat'",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph -6",
    "out": "*   e7978f4 (HEAD -> main) Merge branch 'feature/vat'\n|\\  \n| * f638cab (feature/vat) Raise VAT to 21%\n* | 3c8cbd7 Lower VAT to 19%\n|/  \n*   6d10898 Merge branch 'feature/invoices'\n|\\  \n| * 9a0d298 (feature/invoices) Add invoice numbers\n* | 48d20a6 Add readme\n|/",
    "exit": 0
   }
  ],
  "abort": [
   {
    "cmd": "git merge feature/vat2",
    "out": "Auto-merging price.js\nCONFLICT (content): Merge conflict in price.js\nAutomatic merge failed; fix conflicts and then commit the result.",
    "exit": 1
   },
   {
    "cmd": "git merge --abort",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": "",
    "exit": 0
   }
  ],
  "noFf": [
   {
    "cmd": "git merge --no-ff feature/footer -m \"Merge branch 'feature/footer'\"",
    "out": "Merge made by the 'ort' strategy.\n footer.js | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 footer.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph -3",
    "out": "*   0a30a7f (HEAD -> main) Merge branch 'feature/footer'\n|\\  \n| * a5848c3 (feature/footer) Add footer\n|/  \n*   e7978f4 Merge branch 'feature/vat'\n|\\",
    "exit": 0
   }
  ]
 },
 "rebase": {
  "rebase": [
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* e1e5f22 (main) Fix checkout\n| * 51062be (HEAD -> feature/search) Search by name\n| * be0a11e Add search\n|/  \n* b829903 Add app",
    "exit": 0
   },
   {
    "cmd": "git rebase main",
    "out": "Successfully rebased and updated refs/heads/feature/search.",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* ba22fdd (HEAD -> feature/search) Search by name\n* 23792be Add search\n* e1e5f22 (main) Fix checkout\n* b829903 Add app",
    "exit": 0
   }
  ],
  "ffAfter": [
   {
    "cmd": "git switch main",
    "out": "Switched to branch 'main'",
    "exit": 0
   },
   {
    "cmd": "git merge feature/search",
    "out": "Updating e1e5f22..ba22fdd\nFast-forward\n search.js | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 search.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline",
    "out": "ba22fdd (HEAD -> main, feature/search) Search by name\n23792be Add search\ne1e5f22 Fix checkout\nb829903 Add app",
    "exit": 0
   }
  ],
  "interactive": [
   {
    "cmd": "git log --oneline -3",
    "out": "28f4870 (HEAD -> feature/filters) fix filter\nf7082a6 Add price filter\nba22fdd (main, feature/search) Search by name",
    "exit": 0
   },
   {
    "cmd": "git rebase -i HEAD~2      # in the editor: change \"pick\" to \"fixup\" on the second line",
    "out": "Successfully rebased and updated refs/heads/feature/filters.",
    "exit": 0
   },
   {
    "cmd": "# the todo list git opened in the editor (comments removed)",
    "out": "pick f7082a6 # Add price filter\npick 28f4870 # fix filter",
    "exit": 0
   },
   {
    "cmd": "git log --oneline -2",
    "out": "b1ac83e (HEAD -> feature/filters) Add price filter\nba22fdd (main, feature/search) Search by name",
    "exit": 0
   }
  ],
  "cherryPick": [
   {
    "cmd": "git log --oneline -1",
    "out": "6b009eb (HEAD -> main) Retry failed payments",
    "exit": 0
   },
   {
    "cmd": "git switch release/1.0",
    "out": "Switched to branch 'release/1.0'",
    "exit": 0
   },
   {
    "cmd": "git cherry-pick main",
    "out": "[release/1.0 9c2ce03] Retry failed payments\n Date: Mon Oct 5 09:28:00 2026 +0000\n 1 file changed, 1 insertion(+)\n create mode 100644 pay.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline -2",
    "out": "9c2ce03 (HEAD -> release/1.0) Retry failed payments\n23792be Add search",
    "exit": 0
   }
  ]
 },
 "remotes": {
  "server": [
   {
    "cmd": "git init --bare /srv/git/shop.git        # on the server",
    "out": "Initialized empty Git repository in /srv/git/shop.git/",
    "exit": 0
   }
  ],
  "addRemote": [
   {
    "cmd": "git remote add origin /srv/git/shop.git",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git remote -v",
    "out": "origin\t/srv/git/shop.git (fetch)\norigin\t/srv/git/shop.git (push)",
    "exit": 0
   },
   {
    "cmd": "git push -u origin main",
    "out": "To /srv/git/shop.git\n * [new branch]      main -> main\nbranch 'main' set up to track 'origin/main'.",
    "exit": 0
   },
   {
    "cmd": "git branch -vv",
    "out": "* main 1d525a4 [origin/main] Add app",
    "exit": 0
   },
   {
    "cmd": "git branch -a",
    "out": "* main\n  remotes/origin/main",
    "exit": 0
   }
  ],
  "clone": [
   {
    "cmd": "git clone /srv/git/shop.git              # Bob, on his machine",
    "out": "Cloning into 'shop'...\ndone.",
    "exit": 0
   },
   {
    "cmd": "cat shop/.git/config                     # Bob",
    "out": "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n[remote \"origin\"]\n\turl = /srv/git/shop.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch \"main\"]\n\tremote = origin\n\tmerge = refs/heads/main",
    "exit": 0
   }
  ],
  "fetch": [
   {
    "cmd": "git status",
    "out": "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean",
    "exit": 0
   },
   {
    "cmd": "git fetch",
    "out": "From /srv/git/shop\n   1d525a4..98d5118  main       -> origin/main",
    "exit": 0
   },
   {
    "cmd": "git status",
    "out": "On branch main\nYour branch is behind 'origin/main' by 1 commit, and can be fast-forwarded.\n  (use \"git pull\" to update your local branch)\n\nnothing to commit, working tree clean",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph --all",
    "out": "* 98d5118 (origin/main, origin/HEAD) Bob: improve app\n* 1d525a4 (HEAD -> main) Add app",
    "exit": 0
   }
  ],
  "pullFf": [
   {
    "cmd": "git pull",
    "out": "Updating 1d525a4..98d5118\nFast-forward\n app.js | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)",
    "exit": 0
   }
  ],
  "rejected": [
   {
    "cmd": "git push",
    "out": "To /srv/git/shop.git\n ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to '/srv/git/shop.git'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details.",
    "exit": 1
   },
   {
    "cmd": "git fetch",
    "out": "From /srv/git/shop\n   98d5118..4a8ed29  main       -> origin/main",
    "exit": 0
   },
   {
    "cmd": "git status",
    "out": "On branch main\nYour branch and 'origin/main' have diverged,\nand have 1 and 1 different commits each, respectively.\n  (use \"git pull\" if you want to integrate the remote branch with yours)\n\nnothing to commit, working tree clean",
    "exit": 0
   },
   {
    "cmd": "git pull",
    "out": "hint: You have divergent branches and need to specify how to reconcile them.\nhint: You can do so by running one of the following commands sometime before\nhint: your next pull:\nhint:\nhint:   git config pull.rebase false  # merge\nhint:   git config pull.rebase true   # rebase\nhint:   git config pull.ff only       # fast-forward only\nhint:\nhint: You can replace \"git config\" with \"git config --global\" to set a default\nhint: preference for all repositories. You can also pass --rebase, --no-rebase,\nhint: or --ff-only on the command line to override the configured default per\nhint: invocation.\nfatal: Need to specify how to reconcile divergent branches.",
    "exit": 128
   }
  ],
  "pullRebase": [
   {
    "cmd": "git pull --rebase",
    "out": "Successfully rebased and updated refs/heads/main.",
    "exit": 0
   },
   {
    "cmd": "git log --oneline --graph -4",
    "out": "* cbdc23d (HEAD -> main) Ann: add cart\n* 4a8ed29 (origin/main, origin/HEAD) Bob: retry payments\n* 98d5118 Bob: improve app\n* 1d525a4 Add app",
    "exit": 0
   },
   {
    "cmd": "git push",
    "out": "To /srv/git/shop.git\n   4a8ed29..cbdc23d  main -> main",
    "exit": 0
   }
  ],
  "lease": [
   {
    "cmd": "git push --force-with-lease",
    "out": "To /srv/git/shop.git\n ! [rejected]        main -> main (stale info)\nerror: failed to push some refs to '/srv/git/shop.git'",
    "exit": 1
   },
   {
    "cmd": "git fetch && git status",
    "out": "From /srv/git/shop\n   cbdc23d..2f461fe  main       -> origin/main\nOn branch main\nYour branch and 'origin/main' have diverged,\nand have 1 and 2 different commits each, respectively.\n  (use \"git pull\" if you want to integrate the remote branch with yours)\n\nnothing to commit, working tree clean",
    "exit": 0
   }
  ],
  "branches": [
   {
    "cmd": "git switch -c feature/search",
    "out": "Switched to a new branch 'feature/search'",
    "exit": 0
   },
   {
    "cmd": "git add search.js && git commit -m \"Add search\"",
    "out": "[feature/search 004e4b1] Add search\n 1 file changed, 1 insertion(+)\n create mode 100644 search.js",
    "exit": 0
   },
   {
    "cmd": "git push -u origin feature/search",
    "out": "To /srv/git/shop.git\n * [new branch]      feature/search -> feature/search\nbranch 'feature/search' set up to track 'origin/feature/search'.",
    "exit": 0
   },
   {
    "cmd": "git branch -vv",
    "out": "* feature/search 004e4b1 [origin/feature/search] Add search\n  main           2f461fe [origin/main] Bob: retry 5 times",
    "exit": 0
   },
   {
    "cmd": "git push origin --delete feature/search",
    "out": "To /srv/git/shop.git\n - [deleted]         feature/search",
    "exit": 0
   }
  ]
 },
 "accounts": {
  "keys": [
   {
    "cmd": "mkdir -p ~/.ssh && chmod 700 ~/.ssh",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "ssh-keygen -t ed25519 -C \"ann@work.example\" -f ~/.ssh/id_ed25519_work",
    "out": "Generating public/private ed25519 key pair.\nYour identification has been saved in /home/ann/.ssh/id_ed25519_work\nYour public key has been saved in /home/ann/.ssh/id_ed25519_work.pub\nThe key fingerprint is:\nSHA256:jKWfLBibJOeGFv+e4k0EOhm/q6qbPrUTz7Svk/mv57U ann@work.example\nThe key's randomart image is:\n+--[ED25519 256]--+\n|                 |\n|                 |\n|  . .   .        |\n|   = . =         |\n|  * = + S        |\n|   % O o .       |\n|  + # * +  .     |\n| + +.% o .. .    |\n|B+oo++X+=o E     |\n+----[SHA256]-----+",
    "exit": 0
   },
   {
    "cmd": "stat -c \"%A  %n\" ~/.ssh/*",
    "out": "-rw-------  /home/ann/.ssh/id_ed25519_personal\n-rw-r--r--  /home/ann/.ssh/id_ed25519_personal.pub\n-rw-------  /home/ann/.ssh/id_ed25519_work\n-rw-r--r--  /home/ann/.ssh/id_ed25519_work.pub",
    "exit": 0
   },
   {
    "cmd": "cat ~/.ssh/id_ed25519_personal.pub        # this is what you paste into the hosting site",
    "out": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJLo",
    "exit": 0
   }
  ],
  "sshConfig": [
   {
    "cmd": "chmod 600 ~/.ssh/config && cat ~/.ssh/config",
    "out": "# Work account\nHost github.com-work\n    HostName github.com\n    User git\n    IdentityFile ~/.ssh/id_ed25519_work\n    IdentitiesOnly yes\n\n# Personal account\nHost github.com-personal\n    HostName github.com\n    User git\n    IdentityFile ~/.ssh/id_ed25519_personal\n    IdentitiesOnly yes",
    "exit": 0
   },
   {
    "cmd": "ssh -G github.com-work | grep -E \"^(hostname|user|identityfile|identitiesonly) \"",
    "out": "user git\nhostname github.com\nidentitiesonly yes\nidentityfile ~/.ssh/id_ed25519_work",
    "exit": 0
   },
   {
    "cmd": "ssh -G github.com-personal | grep -E \"^(hostname|user|identityfile|identitiesonly) \"",
    "out": "user git\nhostname github.com\nidentitiesonly yes\nidentityfile ~/.ssh/id_ed25519_personal",
    "exit": 0
   }
  ],
  "includeIf": [
   {
    "cmd": "cat ~/.gitconfig",
    "out": "[user]\n\tname = Ann Lee\n\temail = ann@personal.example\n[init]\n\tdefaultBranch = main\n[includeIf \"gitdir:~/work/\"]\n\tpath = ~/.gitconfig-work",
    "exit": 0
   },
   {
    "cmd": "cat ~/.gitconfig-work",
    "out": "[user]\n\temail = ann@work.example\n[url \"git@github.com-work:\"]\n\tinsteadOf = git@github.com:\n[core]\n\tsshCommand = ssh -i ~/.ssh/id_ed25519_work -o IdentitiesOnly=yes",
    "exit": 0
   },
   {
    "cmd": "cd ~/work/api && git config --show-origin user.email",
    "out": "file:/home/ann/.gitconfig-work\tann@work.example",
    "exit": 0
   },
   {
    "cmd": "cd ~/personal/blog && git config --show-origin user.email",
    "out": "file:/home/ann/.gitconfig\tann@personal.example",
    "exit": 0
   },
   {
    "cmd": "cd ~/work/api && git config --show-origin core.sshCommand",
    "out": "file:/home/ann/.gitconfig-work\tssh -i ~/.ssh/id_ed25519_work -o IdentitiesOnly=yes",
    "exit": 0
   }
  ],
  "urls": [
   {
    "cmd": "git config remote.origin.url          # in ~/work/api: what is stored",
    "out": "git@github.com:acme-example/api.git",
    "exit": 0
   },
   {
    "cmd": "git remote -v                          # what git uses after insteadOf",
    "out": "origin\tgit@github.com-work:acme-example/api.git (fetch)\norigin\tgit@github.com-work:acme-example/api.git (push)",
    "exit": 0
   }
  ],
  "hasconfig": [
   {
    "cmd": "cd ~/code/new-service && git remote get-url origin && git config --show-origin user.email",
    "out": "git@github.com-work:acme-example/new-service.git\nfile:/home/ann/.gitconfig-work\tann@work.example",
    "exit": 0
   },
   {
    "cmd": "cd ~/personal/blog && git config --show-origin user.email",
    "out": "file:/home/ann/.gitconfig\tann@personal.example",
    "exit": 0
   }
  ],
  "signing": [
   {
    "cmd": "git config gpg.format ssh\ngit config user.signingkey ~/.ssh/id_ed25519_personal.pub\ngit config commit.gpgsign true",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git commit -m \"Start blog\"",
    "out": "[main (root-commit) 94e74c2] Start blog\n 1 file changed, 1 insertion(+)\n create mode 100644 README.md",
    "exit": 0
   },
   {
    "cmd": "git log --show-signature -1",
    "out": "commit 94e74c2807c796a1d3523835ab4abbc3029f7191\nGood \"git\" signature for ann@personal.example with ED25519 key SHA256:NcrqtKhNS4bQ937/hIw7sKQ83t6qJ6kehUMB3o8Nj5E\nAuthor: Ann Lee <ann@personal.example>\nDate:   Mon Oct 5 09:24:00 2026 +0000\n\n    Start blog",
    "exit": 0
   }
  ],
  "whoami": [
   {
    "cmd": "git var GIT_AUTHOR_IDENT          # in ~/personal/blog",
    "out": "Ann Lee <ann@personal.example> 1791192360 +0000",
    "exit": 0
   },
   {
    "cmd": "git var GIT_AUTHOR_IDENT          # in ~/code/new-service",
    "out": "Ann Lee <ann@work.example> 1791192420 +0000",
    "exit": 0
   }
  ]
 },
 "accounts-setup": {
  "script": "#!/usr/bin/env bash\n# One-time Git setup for several accounts. Edit these lines, then run: bash git-accounts.sh\nset -euo pipefail\n\nNAME=\"Ann Lee\"\nPERSONAL_EMAIL=\"ann@personal.example\"   # GitHub, personal account (the default everywhere)\nWORK_EMAIL=\"ann@work.example\"           # GitHub, work account   → repositories under ~/work/\nCLIENT_EMAIL=\"ann@client.example\"       # GitLab, client account → repositories under ~/clients/acme/\n\nmkdir -p ~/.ssh ~/work ~/clients/acme\nchmod 700 ~/.ssh\n\n# 1. One key per account (you will be asked for a passphrase — use one).\n[ -f ~/.ssh/id_ed25519_personal ] || ssh-keygen -t ed25519 -C \"$PERSONAL_EMAIL\" -f ~/.ssh/id_ed25519_personal\n[ -f ~/.ssh/id_ed25519_work ]     || ssh-keygen -t ed25519 -C \"$WORK_EMAIL\"     -f ~/.ssh/id_ed25519_work\n[ -f ~/.ssh/id_ed25519_client ]   || ssh-keygen -t ed25519 -C \"$CLIENT_EMAIL\"   -f ~/.ssh/id_ed25519_client\n\n# 2. Which key for which host. Plain github.com is the personal account.\ncat >> ~/.ssh/config <<'SSH'\n\nHost github.com\n    IdentityFile ~/.ssh/id_ed25519_personal\n    IdentitiesOnly yes\n\nHost github.com-work\n    HostName github.com\n    User git\n    IdentityFile ~/.ssh/id_ed25519_work\n    IdentitiesOnly yes\n\nHost gitlab.com-client\n    HostName gitlab.com\n    User git\n    IdentityFile ~/.ssh/id_ed25519_client\n    IdentitiesOnly yes\nSSH\nchmod 600 ~/.ssh/config\n\n# 3. Commit identity: personal by default, work and client by folder.\ngit config --global user.name \"$NAME\"\ngit config --global user.email \"$PERSONAL_EMAIL\"\ngit config --global init.defaultBranch main\ngit config --global includeIf.\"gitdir:~/work/\".path ~/.gitconfig-work\ngit config --global includeIf.\"gitdir:~/clients/acme/\".path ~/.gitconfig-client\n\ngit config --file ~/.gitconfig-work user.email \"$WORK_EMAIL\"\ngit config --file ~/.gitconfig-work url.\"git@github.com-work:\".insteadOf \"git@github.com:\"\n\ngit config --file ~/.gitconfig-client user.email \"$CLIENT_EMAIL\"\ngit config --file ~/.gitconfig-client url.\"git@gitlab.com-client:\".insteadOf \"git@gitlab.com:\"\n\n# 4. Public keys to add on each site (GitHub: Settings → SSH and GPG keys; GitLab: Preferences → SSH Keys).\nfor account in personal work client; do\n  echo \"== $account\"\n  cat ~/.ssh/id_ed25519_$account.pub\ndone\n",
  "run": [
   {
    "cmd": "bash git-accounts.sh        # recorded with an empty passphrase; public keys shortened",
    "out": "== personal\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ/w/Pz3DfgTMdDfQ6vi/sUB\n== work\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFseZQAhGdVnovaenLYaGmM1\n== client\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM2UIlUCtJguE5VN4jdms9eq",
    "exit": 0
   }
  ],
  "verifySsh": [
   {
    "cmd": "ssh -G github.com | grep -E \"^(hostname|identityfile) \"",
    "out": "hostname github.com\nidentityfile ~/.ssh/id_ed25519_personal",
    "exit": 0
   },
   {
    "cmd": "ssh -G github.com-work | grep -E \"^(hostname|identityfile) \"",
    "out": "hostname github.com\nidentityfile ~/.ssh/id_ed25519_work",
    "exit": 0
   },
   {
    "cmd": "ssh -G gitlab.com-client | grep -E \"^(hostname|identityfile) \"",
    "out": "hostname gitlab.com\nidentityfile ~/.ssh/id_ed25519_client",
    "exit": 0
   }
  ],
  "verifyRepos": [
   {
    "cmd": "cd ~/code/blog && git config --show-origin user.email && git remote get-url --push origin",
    "out": "file:/home/ann/.gitconfig\tann@personal.example\ngit@github.com:ann-example/blog.git",
    "exit": 0
   },
   {
    "cmd": "cd ~/work/api && git config --show-origin user.email && git remote get-url --push origin",
    "out": "file:/home/ann/.gitconfig-work\tann@work.example\ngit@github.com-work:acme-example/api.git",
    "exit": 0
   },
   {
    "cmd": "cd ~/clients/acme/portal && git config --show-origin user.email && git remote get-url --push origin",
    "out": "file:/home/ann/.gitconfig-client\tann@client.example\ngit@gitlab.com-client:acme-client/portal.git",
    "exit": 0
   }
  ],
  "cloneUsesRewrite": true,
  "laterFetchUsesRewrite": true
 },
 "undo": {
  "amend": [
   {
    "cmd": "git add pay.js && git commit -m \"Add paymnet\"",
    "out": "[main 09dcc28] Add paymnet\n 1 file changed, 1 insertion(+)\n create mode 100644 pay.js",
    "exit": 0
   },
   {
    "cmd": "git add pay.js && git commit --amend -m \"Add payment\"",
    "out": "[main fbf6634] Add payment\n Date: Mon Oct 5 09:07:00 2026 +0000\n 1 file changed, 2 insertions(+)\n create mode 100644 pay.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline",
    "out": "fbf6634 (HEAD -> main) Add payment\n567d86a Add cart\nb829903 Add app",
    "exit": 0
   }
  ],
  "soft": [
   {
    "cmd": "git reset --soft HEAD~1",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": "A  pay.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline",
    "out": "567d86a (HEAD -> main) Add cart\nb829903 Add app",
    "exit": 0
   }
  ],
  "mixed": [
   {
    "cmd": "git reset HEAD~1",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": "?? cart.js\n?? pay.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline",
    "out": "b829903 (HEAD -> main) Add app",
    "exit": 0
   }
  ],
  "hard": [
   {
    "cmd": "git add . && git commit -q -m \"Add cart and payment\" && git log --oneline",
    "out": "aaf5cdb (HEAD -> main) Add cart and payment\nb829903 Add app",
    "exit": 0
   },
   {
    "cmd": "git reset --hard HEAD~1",
    "out": "HEAD is now at b829903 Add app",
    "exit": 0
   },
   {
    "cmd": "git status --short && ls",
    "out": "app.js",
    "exit": 0
   }
  ],
  "reflog": [
   {
    "cmd": "git reflog -5",
    "out": "b829903 (HEAD -> main) HEAD@{0}: reset: moving to HEAD~1\naaf5cdb HEAD@{1}: commit: Add cart and payment\nb829903 (HEAD -> main) HEAD@{2}: reset: moving to HEAD~1\n567d86a HEAD@{3}: reset: moving to HEAD~1\nfbf6634 HEAD@{4}: commit (amend): Add payment",
    "exit": 0
   },
   {
    "cmd": "git reset --hard HEAD@{1}",
    "out": "HEAD is now at aaf5cdb Add cart and payment",
    "exit": 0
   },
   {
    "cmd": "git log --oneline && ls",
    "out": "aaf5cdb (HEAD -> main) Add cart and payment\nb829903 Add app\napp.js\ncart.js\npay.js",
    "exit": 0
   }
  ],
  "revert": [
   {
    "cmd": "git revert --no-edit HEAD",
    "out": "[main 92a7de8] Revert \"Add cart and payment\"\n Date: Mon Oct 5 09:22:00 2026 +0000\n 2 files changed, 3 deletions(-)\n delete mode 100644 cart.js\n delete mode 100644 pay.js",
    "exit": 0
   },
   {
    "cmd": "git log --oneline",
    "out": "92a7de8 (HEAD -> main) Revert \"Add cart and payment\"\naaf5cdb Add cart and payment\nb829903 Add app",
    "exit": 0
   },
   {
    "cmd": "git show --stat --format=\"%h %s%n%n%b\" HEAD",
    "out": "92a7de8 Revert \"Add cart and payment\"\n\nThis reverts commit aaf5cdb156a9eb6ab2ebe33cc9df25afdd8a36f3.\n\n\n cart.js | 1 -\n pay.js  | 2 --\n 2 files changed, 3 deletions(-)",
    "exit": 0
   }
  ],
  "restoreFile": [
   {
    "cmd": "git commit -qam \"Break app\" && cat app.js",
    "out": "v1 broken",
    "exit": 0
   },
   {
    "cmd": "git restore --source=HEAD~1 app.js",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "cat app.js && git status --short",
    "out": "v1\n M app.js",
    "exit": 0
   }
  ],
  "lostBranch": [
   {
    "cmd": "git branch -D experiment",
    "out": "Deleted branch experiment (was 9997ee7).",
    "exit": 0
   },
   {
    "cmd": "git reflog | grep \"Try an idea\"",
    "out": "9997ee7 HEAD@{1}: commit: Try an idea",
    "exit": 0
   },
   {
    "cmd": "git branch experiment HEAD@{1}",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git log --oneline -1 experiment",
    "out": "9997ee7 (experiment) Try an idea",
    "exit": 0
   }
  ]
 },
 "toolbox": {
  "stash": [
   {
    "cmd": "git status --short",
    "out": " M app.js\n?? notes.txt",
    "exit": 0
   },
   {
    "cmd": "git stash push -u -m \"half-done feature\"",
    "out": "Saved working directory and index state On main: half-done feature",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git stash list",
    "out": "stash@{0}: On main: half-done feature",
    "exit": 0
   },
   {
    "cmd": "git stash show -p --include-untracked stash@{0}",
    "out": "diff --git a/app.js b/app.js\nindex 626799f..9a1e460 100644\n--- a/app.js\n+++ b/app.js\n@@ -1 +1,2 @@\n v1\n+half-done feature\ndiff --git a/notes.txt b/notes.txt\nnew file mode 100644\nindex 0000000..258cd57\n--- /dev/null\n+++ b/notes.txt\n@@ -0,0 +1 @@\n+todo",
    "exit": 0
   },
   {
    "cmd": "git stash pop",
    "out": "On branch main\nChanges not staged for commit:\n  (use \"git add <file>...\" to update what will be committed)\n  (use \"git restore <file>...\" to discard changes in working directory)\n\tmodified:   app.js\n\nUntracked files:\n  (use \"git add <file>...\" to include in what will be committed)\n\tnotes.txt\n\nno changes added to commit (use \"git add\" and/or \"git commit -a\")\nDropped refs/stash@{0} (1055c31b48c6021f7096461dc32909790f6d16e1)",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": " M app.js\n?? notes.txt",
    "exit": 0
   }
  ],
  "tags": [
   {
    "cmd": "git tag v1.0.0 -a -m \"First release\"",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git tag",
    "out": "v1.0.0",
    "exit": 0
   },
   {
    "cmd": "git describe",
    "out": "v1.0.0-2-g47c8ed0",
    "exit": 0
   },
   {
    "cmd": "git show v1.0.0 --stat --format=\"%h %s\"",
    "out": "tag v1.0.0\nTagger: Ann Lee <ann@example.com>\n\nFirst release\nf0e7d42 Finish feature\n\n app.js    | 1 +\n notes.txt | 1 +\n 2 files changed, 2 insertions(+)",
    "exit": 0
   }
  ],
  "clean": [
   {
    "cmd": "git clean -n -d",
    "out": "Would remove build/\nWould remove debug.log",
    "exit": 0
   },
   {
    "cmd": "git clean -f -d",
    "out": "Removing build/\nRemoving debug.log",
    "exit": 0
   }
  ],
  "worktree": [
   {
    "cmd": "git worktree add ../shop-hotfix -b hotfix/vat",
    "out": "Preparing worktree (new branch 'hotfix/vat')\nHEAD is now at 47c8ed0 Fix bug",
    "exit": 0
   },
   {
    "cmd": "git worktree list",
    "out": "/home/ann/shop        47c8ed0 [main]\n/home/ann/shop-hotfix 47c8ed0 [hotfix/vat]",
    "exit": 0
   },
   {
    "cmd": "cd ../shop-hotfix && git branch --show-current",
    "out": "hotfix/vat",
    "exit": 0
   },
   {
    "cmd": "git worktree remove ../shop-hotfix",
    "out": "",
    "exit": 0
   }
  ],
  "bisect": [
   {
    "cmd": "git log --oneline -9",
    "out": "9254f2f (HEAD -> bisect-demo) Change 8\nef0a24e Change 7\n688fde7 Refactor total\n739dbd0 Change 5\n0d2b627 Change 4\n45ee336 Change 3\n3e69dfb Change 2\nc1d7b37 Change 1\n47c8ed0 (main, hotfix/vat) Fix bug",
    "exit": 0
   },
   {
    "cmd": "cat test.sh",
    "out": "#!/bin/sh\n# exit 0 = good, 1 = bad\n[ \"$(sh total.sh 2 2)\" = 4 ]",
    "exit": 0
   },
   {
    "cmd": "git bisect start HEAD HEAD~8",
    "out": "Bisecting: 3 revisions left to test after this (roughly 2 steps)\n[0d2b627aea314b3d719a748382d5fa96b9f65d25] Change 4",
    "exit": 0
   },
   {
    "cmd": "git bisect run ./test.sh",
    "out": "running './test.sh'\nBisecting: 1 revision left to test after this (roughly 1 step)\n[688fde71cbd7d16c0424a057f354671b75a4c29e] Refactor total\nrunning './test.sh'\nBisecting: 0 revisions left to test after this (roughly 0 steps)\n[739dbd0cac12c42bb82ab4f69f726a4a79b4f994] Change 5\nrunning './test.sh'\n688fde71cbd7d16c0424a057f354671b75a4c29e is the first bad commit\ncommit 688fde71cbd7d16c0424a057f354671b75a4c29e\nAuthor: Ann Lee <ann@example.com>\nDate:   Mon Oct 5 09:33:00 2026 +0000\n\n    Refactor total\n\n total.sh | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\nbisect found first bad commit",
    "exit": 0
   },
   {
    "cmd": "git bisect reset",
    "out": "Previous HEAD position was 739dbd0 Change 5\nSwitched to branch 'bisect-demo'",
    "exit": 0
   }
  ]
 },
 "workflow": {
  "ignore": [
   {
    "cmd": "cat .gitignore",
    "out": "node_modules/\ndist/\n*.log\n.env\n!.env.example",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": "?? .env.example\n?? .gitignore",
    "exit": 0
   },
   {
    "cmd": "git check-ignore -v .env error.log dist/app.js",
    "out": ".gitignore:4:.env\t.env\n.gitignore:3:*.log\terror.log\n.gitignore:2:dist/\tdist/app.js",
    "exit": 0
   },
   {
    "cmd": "git status --short --ignored",
    "out": "?? .env.example\n?? .gitignore\n!! .env\n!! dist/\n!! error.log\n!! node_modules/",
    "exit": 0
   }
  ],
  "untrack": [
   {
    "cmd": "git status --short",
    "out": " M .gitignore",
    "exit": 0
   },
   {
    "cmd": "git rm --cached secrets.json",
    "out": "rm 'secrets.json'",
    "exit": 0
   },
   {
    "cmd": "git status --short",
    "out": " M .gitignore\nD  secrets.json",
    "exit": 0
   },
   {
    "cmd": "ls secrets.json",
    "out": "secrets.json",
    "exit": 0
   }
  ],
  "hook": [
   {
    "cmd": "cat .git/hooks/pre-commit",
    "out": "#!/bin/sh\nif git diff --cached | grep -q \"console.log\"; then\n  echo \"pre-commit: remove console.log before committing\" >&2\n  exit 1\nfi",
    "exit": 0
   },
   {
    "cmd": "git add debug.js && git commit -m \"Debug order\"",
    "out": "pre-commit: remove console.log before committing",
    "exit": 1
   },
   {
    "cmd": "git commit --no-verify -m \"Debug order\"     # skips hooks — use rarely",
    "out": "[main 58b8582] Debug order\n 2 files changed, 1 insertion(+), 1 deletion(-)\n create mode 100644 debug.js\n delete mode 100644 secrets.json",
    "exit": 0
   }
  ],
  "aliases": [
   {
    "cmd": "git config --global alias.lg \"log --oneline --graph --all\"",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git config --global alias.st \"status --short --branch\"",
    "out": "",
    "exit": 0
   },
   {
    "cmd": "git st",
    "out": "## main\n M .gitignore",
    "exit": 0
   },
   {
    "cmd": "git lg",
    "out": "* 58b8582 (HEAD -> main) Debug order\n* 5db2fb1 Add config\n* 313ec14 Add ignore rules\n* b829903 Add app",
    "exit": 0
   }
  ]
 }
} as const
