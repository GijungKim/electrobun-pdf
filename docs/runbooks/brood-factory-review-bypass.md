# Brood Factory PR review bypass

## Status and scope

This is an operator handoff, not an enabled bypass. No GitHub settings, merge
behavior, or CI permissions are changed by this document. Brood Factory owns
publishing and merging; its implementation is not in this repository.

Read-only inspection on 2026-09-07 UTC found:

- PR [#34](https://github.com/GijungKim/electrobun-pdf/pull/34), `$resolve-prs`,
  is authored by `GijungKim`, uses `brood/prompt-1-11a605`, and reports
  `REVIEW_REQUIRED`.
- The repository belongs to a **personal account**, not an organization.
- Active repository ruleset [sanity (13905037)](https://github.com/GijungKim/electrobun-pdf/rules/13905037)
  targets the default branch. It requires one approving review, code-owner
  review, stale-review dismissal, resolved review threads, and signed commits,
  and prevents deletion and non-fast-forward updates.
- That ruleset already grants the administrator role (`RepositoryRole`, ID `5`)
  an `always` bypass. The inspecting CLI identity has admin permissions and the
  API reports `current_user_can_bypass: "always"`. This does **not** establish
  which credential the Factory publisher uses.
- Classic branch protection for `main` returned HTTP 404, `Branch not protected`;
  this does not mean the ruleset is inactive. The ruleset has no required-status-
  check rule. CI runs typechecking and tests in the `typecheck` job.

GitHub does not allow authors to approve their own PRs. A review decision of
`REVIEW_REQUIRED` is not evidence that an eligible merging actor cannot bypass.
Do not add a self-approval workflow or disable reviews for everyone.

## Operator investigation (read-only)

Recheck live state before taking action; the snapshot above can become stale.
Run these with the publisher's identity in its approved environment, without
copying credentials into this repository or task logs:

```sh
gh api repos/GijungKim/electrobun-pdf --jq '{owner_type: .owner.type, default_branch, permissions}'
gh api 'repos/GijungKim/electrobun-pdf/rulesets?includes_parents=true' --paginate
gh api repos/GijungKim/electrobun-pdf/rulesets/13905037
gh api repos/GijungKim/electrobun-pdf/branches/main/protection
gh pr view 34 --repo GijungKim/electrobun-pdf --json author,headRefOid,reviewDecision,mergeStateStatus,statusCheckRollup
```

Inspect Factory's merge decision and actual GitHub error separately from the
self-approval error. If its publisher is already bypass-eligible, investigate
whether Factory unconditionally waits for `APPROVED`. Changing that policy
belongs in the Factory repository, with tests; do not blindly retry every merge
failure with administrator override. This worktree cannot establish that cause.

## Resuming saved completion requests (controller-owner handoff)

This procedure belongs to the authorized Factory controller owner, not an app
worktree. Do not create replacement Drone jobs or duplicate PRs to retry shipping.

1. **Verify the running controller first.** Record its running build/commit and
   evidence that it contains the updated review-bypass merge logic. A source-tree
   change or passing tests alone does not prove that the running process loaded
   it. If runtime provenance cannot be established, stop before resuming requests;
   any controller rollout remains an operator-owned action.
2. **Recover trusted records.** Inspect existing Drone records and their saved
   completion requests for the authorized GijungKim-owned repositories. Preserve
   each request's identity, repository, PR number, and exact approved head SHA.
   Do not infer approval or Factory ownership from a branch name, label, PR
   author, or this document. Missing records or approval evidence block resumption.
3. **Reconcile before retrying.** Read each recorded PR's live state. Report an
   already-merged PR as merged without submitting another merge. A closed,
   unmerged PR stays blocked rather than being recreated. For open PRs, require
   the live head to equal the saved approved SHA, successful GitHub checks for
   that SHA, and confirmed absence of merge conflicts. Missing, pending, failed,
   cancelled, or otherwise non-successful checks and unknown mergeability block
   the request; do not treat an empty required-check list as successful CI.
4. **Limit the exception.** Verify the actual publisher's bypass eligibility and
   the owner's authorization for that repository. Only missing required reviews
   qualify for the authorized admin exception; other policy failures stay blocked.
   An administrator's broad GitHub bypass capability is not permission to skip
   the checks above or expand repository access.
5. **Resume, do not replace.** Use Factory's supported saved-request resumption
   path. Revalidate the gates at execution time and constrain the merge to the
   exact approved head SHA. A changed head requires fresh approval, not an
   updated SHA copied into the old request. Stop on non-review failures rather
   than retrying them with a broader override.
6. **Confirm and report.** Re-read GitHub after each attempt and retain an audit
   record of request/Drone identity, repository/PR, approved and observed SHA,
   check results, controller version, publisher identity, authorization, and
   outcome. Report each PR as merged or blocked with a specific reason; an
   accepted resume request is not proof of a merge.

### Follow-up inspection on 2026-09-07 UTC

Read-only inspection from the electrobun-pdf worktree returned no open PRs:

```sh
gh pr list --repo GijungKim/electrobun-pdf --state open --limit 100 --json number,title,url,headRefName,headRefOid
gh pr view 34 --repo GijungKim/electrobun-pdf --json number,url,state,headRefOid,reviewDecision,mergeable,mergeStateStatus,statusCheckRollup
```

PR #34 is now `MERGED`, with reported head
`911d09023029d902c547e2374ef614e9a2d0dab9` and a completed `SUCCESS` result for
the CI `typecheck` job. Its review decision still reports `REVIEW_REQUIRED`;
that field alone does not establish whether a PR remains open. This inspection
did not merge it or establish which merge path was used.

Factory implementation and saved Drone records are not present in this app
worktree. Executor tool discovery returned no matching Factory/controller or
GitHub tools. The running controller version, saved approval SHA, publisher
authorization, and PR outcomes in other repositories therefore remain unverified.
No completion requests were resumed. Cross-repository resumption remains blocked
for this session pending controller-owner verification; this is not a finding
that every other repository's PR is individually blocked.

## Proposed global policy (requires separate administrative approval)

1. Use a dedicated Brood Factory GitHub App as the **merging actor**, with only
   the installation access and repository permissions needed. Ruleset bypass
   identifies the actor performing the operation, not the PR's title, label,
   author string, or source-branch prefix. No App identity has been verified here.
2. Grant that App **For pull requests only** (`pull_request`) bypass on a
   review-policy ruleset. Keep required status checks, signatures, deletion and
   force-push protections in separate enforced rulesets without the App bypass.
   Bypass applies to an entire ruleset, not just its approval count: adding the
   App to the current combined `sanity` ruleset would also bypass other rules.
   Preserve protection throughout any operator-managed ruleset restructuring.
3. For organization-owned repositories, an organization ruleset can target the
   intended repositories centrally, subject to GitHub plan support. All other
   applicable rulesets and classic protections still apply. This personal-account
   repository cannot inherit an organization ruleset; it needs repository-level
   configuration. There is no repository YAML switch granting a cross-owner
   global bypass. Factory-wide policy must respect each owner's authorization.
4. Factory must authenticate the PR against trusted scheduling/publishing records,
   verify the repository and exact head SHA, and require successful CI for that
   SHA before using the review exception. Branch names and labels alone are
   spoofable. Missing/pending/failed checks, changed heads, untrusted PRs, and
   non-review merge failures must fail closed. Keep an audit trail of actor, PR,
   SHA, checks, and bypass reason. Do not expose publisher credentials to PR code.

The existing administrator bypass is broader than this proposal. Do not expand
it to all writers or silently remove it as part of implementation. Any change to
existing access requires a separate operator decision.

## Acceptance and rollback handoff

In an operator-approved test repository, verify that a trusted Factory PR with
green checks can merge without self-approval, an ordinary PR still needs review,
and failed/pending/missing checks and a changed head block the publisher. Verify
that the App cannot bypass signatures or push directly to the protected branch.
Test overlapping protections and spoofed Factory labels/branch names as well.
Actual merges and settings changes are operator actions, not checks run here.

Before rollout, the operator should retain the previous ruleset configuration
and Factory policy. If validation fails, stop bypass attempts and restore the
prior policy through the approved administrative process; do not delete rulesets
or turn off protections as a fallback.

Reference: GitHub's [ruleset creation and bypass documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).
