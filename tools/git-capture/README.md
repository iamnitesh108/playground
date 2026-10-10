# git-capture

Records real git output for the `git` module. Every experiment runs in a throwaway home directory
(no system or user configuration, a neutral identity, fixed commit dates so hashes are stable), and
paths are shown as `/home/ann/…` and `/srv/…`. The capture fails if any output contains the
username or home directory of the machine running it.

```sh
node capture.mjs ../../src/modules/git/data/captures.ts
```

Check the commit graph simulator against real git (from the repository root):

```sh
node tools/git-capture/check-simulator.mjs
```
