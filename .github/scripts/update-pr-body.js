/**
 * Updates the pull request body with detailed information.
 *
 * @param {Object} params - The script parameters
 * @param {Object} params.github - GitHub API client
 * @param {Object} params.context - GitHub Actions context
 * @param {Object} params.core - GitHub Actions core utilities
 * @param {number} params.prNumber - Pull request number
 * @param {string} params.body - PR body content in Markdown format
 */
module.exports = async ({ github, context, core, prNumber, body }) => {
  try {
    await github.rest.pulls.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      body: body
    });

    core.info(`Updated PR #${prNumber} with detailed description`);
  } catch (error) {
    core.setFailed(`Failed to update PR body: ${error.message}`);
  }
};
