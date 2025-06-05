require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = ['madisonewebb', 'repo-from-github-api'];

// Helper function to handle errors
const handleError = (action, error) => {
    console.error(`Error ${action}:`, error.message);
    if (error.response) console.error('Details:', error.response.data);
    throw error;
};

// Ensure repository exists or create it
const ensureRepoExists = async () => {
    try {
        const { data } = await octokit.rest.repos.get({ owner, repo });
        console.log(`Repository exists: ${data.html_url}`);
        return data;
    } catch (error) {
        if (error.status === 404) {
            console.log('Creating repository...');
            const { data } = await octokit.rest.repos.createForAuthenticatedUser({
                name: repo, private: true, auto_init: true
            });
            console.log('Created repository:', data.html_url);
            return data;
        }
        throw error;
    }
};

// Create an issue
const createIssue = async () => {
    const { data } = await octokit.rest.issues.create({
        owner, repo, title: 'First Issue', body: 'Created via GitHub API'
    });
    console.log('Created issue:', data.html_url);
    return data;
};

// Create a pull request with a README update
const createPullRequest = async () => {
    const branch = 'update-readme';
    
    // Create branch from main
    const { data: { object: { sha } } } = await octokit.rest.git.getRef({
        owner, repo, ref: 'heads/main'
    });
    
    await octokit.rest.git.createRef({
        owner, repo, ref: `refs/heads/${branch}`, sha
    });
    
    // Update README
    const content = `# ${repo}\n\nUpdated on ${new Date().toISOString()}`;
    const { data: blob } = await octokit.rest.git.createBlob({
        owner, repo, content, encoding: 'utf-8'
    });
    
    const { data: tree } = await octokit.rest.git.createTree({
        owner, repo, base_tree: sha,
        tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: blob.sha }]
    });
    
    const { data: commit } = await octokit.rest.git.createCommit({
        owner, repo, message: 'Update README.md', tree: tree.sha, parents: [sha]
    });
    
    await octokit.rest.git.updateRef({
        owner, repo, ref: `heads/${branch}`, sha: commit.sha
    });
    
    // Create PR
    const { data: pr } = await octokit.rest.pulls.create({
        owner, repo, title: 'Update README',
        head: branch, base: 'main',
        body: 'Automated PR from GitHub API'
    });
    
    console.log('Created PR:', pr.html_url);
    return pr;
};

// Main execution
(async () => {
    try {
        await ensureRepoExists();
        await createIssue();
        await createPullRequest();
        console.log('All done!');
    } catch (error) {
        handleError('in main execution', error);
        process.exit(1);
    }
})();
