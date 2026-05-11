/**
 * GWD branch naming patterns — single source of truth.
 *
 * gwd/<worktree>/<milestone>/<slice>  → SLICE_BRANCH_RE
 * gwd/quick/<id>-<slug>               → QUICK_BRANCH_RE
 * gwd/<workflow-template>/<...>        → WORKFLOW_BRANCH_RE
 */

/** Matches gwd/ slice branches: gwd/[worktree/]M001[-hash]/S01 */
export const SLICE_BRANCH_RE = /^gwd\/(?:([a-zA-Z0-9_-]+)\/)?(M\d+(?:-[a-z0-9]{6})?)\/(S\d+)$/;

/** Matches gwd/quick/ task branches */
export const QUICK_BRANCH_RE = /^gwd\/quick\//;

/** Matches GWD-generated workflow template branches, not arbitrary user gwd/* branches. */
export const WORKFLOW_BRANCH_RE = /^gwd\/(?:hotfix|bugfix|small-feature|refactor|spike|security-audit|dep-upgrade|full-project)\//;
