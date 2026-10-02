/**
 * Generates a detailed pull request body for the translation synchronization workflow.
 *
 * @param {Object} params - The script parameters
 * @param {Object} params.github - GitHub API client
 * @param {Object} params.context - GitHub Actions context
 * @param {Object} params.core - GitHub Actions core utilities
 */
module.exports = async ({ github, context, core }) => {
  const branchName = 'auto-sync-translations';

  try {
    // Get commit history for this PR
    const { data: comparison } = await github.rest.repos.compareCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      base: 'main',
      head: branchName
    });

    // Get historical commits since last sync
    const lastSyncDate = await getLastSyncDate(github, context);
    const historyCommits = await getHistoryCommits(github, context, lastSyncDate);

    // Generate statistics
    const stats = generateStats(comparison);

    // Generate PR body
    const body = generatePRBody(comparison, historyCommits, stats, context);
    core.setOutput('body', body);

    core.info('Generated PR body successfully');
  } catch (error) {
    core.setFailed(`Failed to generate PR body: ${error.message}`);
  }
};

/**
 * Gets the date of the last merged synchronization PR.
 *
 * @param {Object} github - GitHub API client
 * @param {Object} context - GitHub Actions context
 * @returns {Promise<string>} ISO date string
 */
async function getLastSyncDate(github, context) {
  try {
    const { data: prs } = await github.rest.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'closed',
      head: `${context.repo.owner}:auto-sync-translations`,
      per_page: 1
    });

    if (prs.length > 0 && prs[0].merged_at) {
      return prs[0].merged_at;
    }
  } catch (error) {
    core.info(`Could not find last sync PR: ${error.message}`);
  }

  // Default to 7 days ago if no previous sync found
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return sevenDaysAgo.toISOString();
}

/**
 * Gets historical commits affecting I18N files since the specified date.
 *
 * @param {Object} github - GitHub API client
 * @param {Object} context - GitHub Actions context
 * @param {string} since - ISO date string
 * @returns {Promise<Array>} List of commits
 */
async function getHistoryCommits(github, context, since) {
  try {
    const { data: commits } = await github.rest.repos.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: 'HMCL/src/main/resources/assets/lang/I18N.properties',
      since: since,
      per_page: 100
    });

    return commits;
  } catch (error) {
    core.info(`Could not fetch history commits: ${error.message}`);
    return [];
  }
}

/**
 * Generates statistics from the commit comparison.
 *
 * @param {Object} comparison - Commit comparison data
 * @returns {Object} Statistics object
 */
function generateStats(comparison) {
  const filesChanged = comparison.files.length;
  let additions = 0;
  let deletions = 0;

  for (const file of comparison.files) {
    additions += file.additions;
    deletions += file.deletions;
  }

  return {
    filesChanged,
    additions,
    deletions
  };
}

/**
 * Generates the complete PR body in Markdown format.
 *
 * @param {Object} comparison - Commit comparison data
 * @param {Array} historyCommits - Historical commits
 * @param {Object} stats - Statistics object
 * @param {Object} context - GitHub Actions context
 * @returns {string} PR body in Markdown format
 */
function generatePRBody(comparison, historyCommits, stats, context) {
  const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`;

  const commitList = comparison.commits
    .map(c => `- [${c.sha.substring(0, 7)}] ${c.commit.message}`)
    .join('\n');

  const historyList = historyCommits.length > 0
    ? historyCommits
        .map(c => {
          const author = c.author?.login || 'unknown';
          const message = c.commit.message.split('\n')[0];
          return `- [${c.sha.substring(0, 7)}] ${message} (by @${author})\n  - [View diff](${c.html_url})`;
        })
        .join('\n')
    : 'No historical modifications';

  return `## 翻译同步 PR

本 PR 自动同步翻译文件，使其与英文参考文件保持一致。

---

### 本次同步统计

- **修改文件数**：${stats.filesChanged} 个语言文件
- **变更行数**：+${stats.additions} / -${stats.deletions}

---

### 本次 PR 提交历史

${commitList}

[查看完整 diff](${repoUrl}/compare/main...auto-sync-translations)

---

<details>
<summary>相关历史修改（点击展开，共 ${historyCommits.length} 条）</summary>

以下是本次同步前，所有涉及 I18N 文件的人工修改：

${historyList}

</details>

---

### 相关链接

- [英文参考文件](${repoUrl}/blob/main/HMCL/src/main/resources/assets/lang/I18N.properties)
- [翻译贡献指南](${repoUrl}/blob/main/CONTRIBUTING.md#translations)

---

*此 PR 由 GitHub Actions 自动生成*
`;
}
