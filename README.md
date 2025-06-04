[![CI (Basic)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/getting-started.yml/badge.svg)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/getting-started.yml)
[![CI (Self-Hosted)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/self-hosted.yml/badge.svg)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/self-hosted.yml)
[![CI (Composite Action)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/composite.yml/badge.svg)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/composite.yml)
[![Reusable Workflow Caller](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/caller.yml/badge.svg)](https://github.com/madisonewebb/dob-chapter-2/actions/workflows/caller.yml)

# DOB Chapter 2

## GitHub Actions Workflows in This Repo
This repository demonstrates several ways to automate tasks using GitHub Actions, including basic workflows, self-hosted runners, composite actions, and reusable workflows.

## Workflow Files

#### getting-started.yml

This is a basic workflow to get started with GitHub Actions. It runs on GitHub-hosted runners and demonstrates:
- How to trigger workflows on push and manually.
- How to use secrets in workflow steps.
- How to create job outputs and pass them to other jobs.
- How to use a matrix strategy to run jobs in parallel.

#### self-hosted.yml

This workflow is similar to the getting-started workflow, but runs on a self-hosted runner (which you set up on your own machine).
Instead of passing data between jobs using outputs, it demonstrates how to:
- Use the `upload-artifact` and `download-artifact` actions to pass files between jobs.
- Read values from files into environment variables using `GITHUB_ENV`.

#### action.yml

This is a composite action you can use in your workflows. It generates a string output based on an input (or uses a default value) and makes it available to the workflow. This is a building block for more complex automation.

#### composite.yml

This workflow shows how to use your custom composite action within a workflow, and how to pass its output to other jobs using artifacts and environment variables.

#### reusable.yml

This is a reusable workflow. It can be called from other workflows in this or other repositories using the `workflow_call` event. It demonstrates how to accept inputs and run jobs that generate and use outputs.

#### caller.yml

This workflow demonstrates how to call the reusable workflow (`reusable.yml`) at the job level, passing in custom inputs and using the outputs in subsequent jobs.

