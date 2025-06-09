require('dotenv').config();
const { graphql } = require('@octokit/graphql');
const { Octokit } = require('@octokit/rest');

// Initialize Octokit with authentication
const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

// Initialize REST API client
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: 'github-graphql-example',
    timeZone: 'America/Los_Angeles',
    baseUrl: 'https://api.github.com'
});

console.log('Starting GitHub GraphQL operations...');

// 1. Within your organization create a private repository with issues and projects enabled and add a description of your choosing
async function createRepository() {
    const query = `
        mutation($name: String!, $visibility: RepositoryVisibility!, $description: String) {
            createRepository(
                input: {
                    name: $name
                    visibility: $visibility
                    description: $description
                }
            ) {
                repository {
                    id  
                    name
                    url
                    isPrivate
                    hasIssuesEnabled
                    hasProjectsEnabled
                    description
                }
            }
        }
    `;
    
    const variables = {
        name: "repo-from-graphql",
        visibility: "PRIVATE",
        description: "Created via GitHub GraphQL API"
    };
    
    return await graphqlWithAuth({
        query,
        ...variables
    });
}

// 2. Create an issue with just a simple title and body inside that repository
async function createIssue(repositoryId) {
    const query = `
        mutation {
            createIssue(
                input: {
                    repositoryId: "${repositoryId}"
                    title: "First Issue"
                    body: "Created via GitHub GraphQL API"
                }
            ) {
                issue {
                    id
                    title
                    body
                    url
                }
            }
        }
    `;
    
    return await graphqlWithAuth(query);
}

// 3. Get and display the repository you created, as well as the the issue and pull request you made inside of it.
// Create a pull request with a simple title and body inside the repository
async function createPullRequest(repositoryId) {
    try {
        // For a newly created repository, we'll use a combination of GraphQL and REST API
        
        // 1. First, get the repository details using GraphQL
        const repoQuery = `
            query {
                node(id: "${repositoryId}") {
                    ... on Repository {
                        name
                        owner {
                            login
                        }
                        defaultBranchRef {
                            name
                        }
                    }
                }
            }
        `;
        
        const repoInfo = await graphqlWithAuth(repoQuery);
        const repoName = repoInfo.node.name;
        const ownerLogin = repoInfo.node.owner.login;
        const defaultBranchName = repoInfo.node.defaultBranchRef?.name || "main";
        
        console.log(`Repository: ${ownerLogin}/${repoName}, Default branch: ${defaultBranchName}`);
        
        // 2. Create README.md file in the default branch using REST API
        console.log("Creating README.md file...");
        await octokit.repos.createOrUpdateFileContents({
            owner: ownerLogin,
            repo: repoName,
            path: "README.md",
            message: "Initial commit",
            content: Buffer.from("# Repo from GraphQL\n\nCreated via GitHub GraphQL API").toString('base64'),
            branch: defaultBranchName
        });
        
        // 3. Create a feature branch from the default branch using REST API
        console.log("Getting default branch reference...");
        const { data: refData } = await octokit.git.getRef({
            owner: ownerLogin,
            repo: repoName,
            ref: `heads/${defaultBranchName}`
        });
        
        const defaultBranchSha = refData.object.sha;
        console.log(`Default branch SHA: ${defaultBranchSha}`);
        
        // Create the feature branch
        console.log("Creating feature branch...");
        await octokit.git.createRef({
            owner: ownerLogin,
            repo: repoName,
            ref: "refs/heads/feature-branch",
            sha: defaultBranchSha
        });
        
        // 4. Create a new file in the feature branch
        console.log("Adding feature.md file to feature branch...");
        await octokit.repos.createOrUpdateFileContents({
            owner: ownerLogin,
            repo: repoName,
            path: "feature.md",
            message: "Add feature",
            content: Buffer.from("# New Feature\n\nThis is a new feature added via GitHub API").toString('base64'),
            branch: "feature-branch"
        });
        
        // 5. Create a pull request using GraphQL
        console.log("Creating pull request...");
        const createPRQuery = `
            mutation {
                createPullRequest(
                    input: {
                        repositoryId: "${repositoryId}"
                        baseRefName: "${defaultBranchName}"
                        headRefName: "feature-branch"
                        title: "Add new feature"
                        body: "This pull request adds a new feature file created via GitHub API"
                    }
                ) {
                    pullRequest {
                        id
                        title
                        body
                        url
                    }
                }
            }
        `;
        
        const prResponse = await graphqlWithAuth(createPRQuery);
        return prResponse;
    } catch (error) {
        console.error("Error in createPullRequest:", error);
        throw error;
    }
}

// 3. Get and display the repository you created, as well as the the issue and pull request you made inside of it.
async function getRepository() {
    const response = await graphqlWithAuth({query: `
            query {
                repository(owner: "madisonewebb", name: "repo-from-graphql") {
                    id
                    name
                    url
                    isPrivate
                    hasIssuesEnabled
                    hasProjectsEnabled
                    description
                    issues(first: 10) {
                        nodes {
                            id
                            title
                            body
                            url
                        }
                    }
                    pullRequests(first: 10) {
                        nodes {
                            id
                            title
                            body
                            url
                        }
                    }
                }
            }
        `,
    });
    return response;
}

async function getOwnerAndRepoId() {
    const response = await graphqlWithAuth({query: `
      query {
        user(login: "madisonewebb") {
          id
        }
        repository(owner: "madisonewebb", name: "repo-from-graphql") {
          id
        }
      }
    `});
    return {
      ownerId: response.user.id,
      repoId: response.repository.id
    };
  }
  
  // 4. Create a new projectV2 and link it to the repo
  async function createProject(ownerId, repoId) {
    // First, create the project
    const createProjectQuery = `
      mutation {
        createProjectV2(
          input: {
            ownerId: "${ownerId}"
            title: "First Project"
          }
        ) {
          projectV2 {
            id
            title
            url
          }
        }
      }
    `;
    
    // Then, link the repository to the project
    const linkRepoQuery = (projectId, repoId) => `
      mutation {
        linkProjectV2ToRepository(
          input: {
            projectId: "${projectId}"
            repositoryId: "${repoId}"
          }
        ) {
          repository {
            id
            name
          }
        }
      }
    `;
    
    try {
      // 1. Create the project
      const projectResponse = await graphqlWithAuth(createProjectQuery);
      const projectId = projectResponse.createProjectV2.projectV2.id;
      
      // 2. Link the repository to the project
      await graphqlWithAuth(linkRepoQuery(projectId, repoId));
      
      return projectResponse;
    } catch (error) {
      console.error("Error in createProject:", error);
      throw error;
    }
  }

async function main() {
    try {
      console.log("Creating repository...");
      const repoResponse = await createRepository();
      const repoId = repoResponse.createRepository.repository.id;
      console.log("Repository created:", repoResponse.createRepository.repository);
  
      console.log("\n2. Creating issue...");
      const repositoryId = repoResponse.createRepository.repository.id;
      const issueResponse = await createIssue(repositoryId);
      console.log("✅ Issue created successfully!");
      console.log("   URL:", issueResponse.createIssue.issue.url);
      
      console.log("\n3. Creating pull request...");
      try {
        const prResponse = await createPullRequest(repositoryId);
        console.log("✅ Pull request created successfully!");
        console.log("   URL:", prResponse.createPullRequest.pullRequest.url);
      } catch (error) {
        console.log("❌ Failed to create pull request:", error.message);
      }
  
      console.log("Getting user and repo IDs...");
      const ownerRepoData = await getOwnerAndRepoId();
      console.log("Owner and repo IDs:", ownerRepoData);
  
      console.log("Creating project...");
      const projectResponse = await createProject(ownerRepoData.ownerId, ownerRepoData.repoId);
      console.log("Project created:", projectResponse.createProjectV2.projectV2);
  
      console.log("Fetching final repository state...");
      const repoData = await getRepository();
      console.dir(repoData.repository, { depth: null });
  
    } catch (error) {
      console.error("Something went wrong:", error);
    }
  }
  
main();
