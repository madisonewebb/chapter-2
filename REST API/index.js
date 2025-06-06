require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { graphql } = require('@octokit/graphql');

const token = process.env.GITHUB_TOKEN;
const [owner, repo] = ['madisonewebb', 'repo-from-github-api'];

// Initialize GraphQL client
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

// Helper function to handle errors
const handleError = (action, error) => {
  console.error(`Error ${action}:`, error.message);
  if (error.errors) console.error('GraphQL Errors:', error.errors);
  throw error;
};

// Ensure repository exists or create it
const ensureRepoExists = async () => {
  try {
    const { repository } = await graphqlWithAuth(`
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          url
          nameWithOwner
        }
      }
    `, {
      owner,
      repo
    });
    
    console.log(`Repository exists: ${repository.url}`);
    return repository;
  } catch (error) {
    if (error.errors?.[0]?.type === 'NOT_FOUND') {
      console.log('Creating repository...');
      const { createRepository } = await graphqlWithAuth(`
        mutation($name: String!, $visibility: RepositoryVisibility!, $ownerId: ID) {
          createRepository(input: {
            name: $name
            visibility: $visibility
            ownerId: $ownerId
          }) {
            repository {
              id
              url
              nameWithOwner
            }
          }
        }
      `, {
        name: repo,
        visibility: 'PRIVATE',
        ownerId: null // Creates under authenticated user
      });
      
      console.log('Created repository:', createRepository.repository.url);
      return createRepository.repository;
    }
    throw error;
  }
};

// Create an issue using GraphQL
const createIssue = async () => {
  const { createIssue } = await graphqlWithAuth(`
    mutation($repositoryId: ID!, $title: String!, $body: String) {
      createIssue(input: {
        repositoryId: $repositoryId,
        title: $title,
        body: $body
      }) {
        issue {
          id
          url
          title
        }
      }
    }
  `, {
    repositoryId: (await ensureRepoExists()).id,
    title: 'First Issue',
    body: 'Created via GitHub GraphQL API'
  });
  
  console.log('Created issue:', createIssue.issue.url);
  return createIssue.issue;
};

// Create a pull request with a README update
const createPullRequest = async () => {
  const branchName = 'update-readme';
  const repoId = (await ensureRepoExists()).id;
  
  // Get the commit SHA of the main branch
  const { repository } = await graphqlWithAuth(`
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: "refs/heads/main") {
          target {
            ... on Commit {
              oid
            }
          }
        }
      }
    }
  `, { owner, repo });
  
  const commitOid = repository.ref.target.oid;
  
  // Create a new branch
  await graphqlWithAuth(`
    mutation($input: CreateRefInput!) {
      createRef(input: $input) {
        ref {
          id
          name
        }
      }
    }
  `, {
    input: {
      repositoryId: repoId,
      name: `refs/heads/${branchName}`,
      oid: commitOid
    }
  });
  
  // Create a commit with updated README
  const { createCommitOnBranch } = await graphqlWithAuth(`
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
          url
        }
      }
    }
  `, {
    input: {
      branch: {
        repositoryNameWithOwner: `${owner}/${repo}`,
        branchName: branchName
      },
      message: { headline: 'Update README.md' },
      fileChanges: {
        additions: [{
          path: 'README.md',
          contents: Buffer.from(`# ${repo}\n\nUpdated on ${new Date().toISOString()}`).toString('base64')
        }]
      },
      expectedHeadOid: commitOid
    }
  });
  
  // Create pull request
  const { createPullRequest: createPR } = await graphqlWithAuth(`
    mutation($input: CreatePullRequestInput!) {
      createPullRequest(input: $input) {
        pullRequest {
          id
          url
          title
        }
      }
    }
  `, {
    input: {
      repositoryId: repoId,
      baseRefName: 'main',
      headRefName: branchName,
      title: 'Update README',
      body: 'Automated PR from GitHub GraphQL API',
      maintainerCanModify: true
    }
  });
  
  console.log('Created PR:', createPR.pullRequest.url);
  return createPR.pullRequest;
};

// Create a new project and link it to the repository
const createAndLinkProject = async () => {
  const repoId = (await ensureRepoExists()).id;
  
  // Create a new project
  const { createProjectV2 } = await graphqlWithAuth(`
    mutation($input: CreateProjectV2Input!) {
      createProjectV2(input: $input) {
        projectV2 {
          id
          title
          url
        }
      }
    }
  `, {
    input: {
      ownerId: owner,
      title: 'API Managed Project',
      repositoryIds: [repoId]
    }
  });
  
  const project = createProjectV2.projectV2;
  console.log('Created project:', project.url);
  
  // Link the repository to the project
  await graphqlWithAuth(`
    mutation($input: LinkProjectV2ToRepositoryInput!) {
      linkProjectV2ToRepository(input: $input) {
        repository {
          id
          name
        }
      }
    }
  `, {
    input: {
      projectId: project.id,
      repositoryId: repoId
    }
  });
  
  console.log('Linked repository to project');
  return project;
};

// Main execution
(async () => {
  try {
    await ensureRepoExists();
    await createIssue();
    await createPullRequest();
    await createAndLinkProject();
    console.log('All operations completed successfully!');
  } catch (error) {
    handleError('in main execution', error);
    process.exit(1);
  }
})();
