require('dotenv').config();
const { graphql } = require('@octokit/graphql');

// Initialize Octokit with authentication
const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
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

// 2. Create a pull request and an issue with just a simple title and body inside that repository
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
