/**
 * GitHub Service
 * Complete GitHub integration for repository management, code push, and automation
 */

import { logger } from '../utils/logger.js';
import { Octokit } from '@octokit/rest';
import { GeneratedFile } from './codeGenerator.service.js';
import { User } from '../models/User.model.js';

export interface GitHubConfig {
  accessToken: string;
  owner?: string;
  repo?: string;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
}

export interface PushFilesOptions {
  owner: string;
  repo: string;
  branch?: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  message: string;
}

export interface GitHubRepoInfo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  private: boolean;
  description?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl: string;
}

export interface WorkflowConfig {
  name: string;
  on: {
    push?: { branches: string[] };
    pull_request?: { branches: string[] };
    workflow_dispatch?: {};
  };
  jobs: Record<string, any>;
}

class GitHubService {
  private getOctokit(accessToken: string): Octokit {
    return new Octokit({
      auth: accessToken,
      userAgent: 'OrbitAI/1.0.0'
    });
  }

  /**
   * Get authenticated user info
   */
  async getAuthenticatedUser(accessToken: string): Promise<GitHubUser> {
    try {
      const octokit = this.getOctokit(accessToken);
      const { data } = await octokit.users.getAuthenticated();

      return {
        id: data.id,
        login: data.login,
        name: data.name || undefined,
        email: data.email || undefined,
        avatarUrl: data.avatar_url
      };
    } catch (error: any) {
      logger.error('Failed to get authenticated user:', error);
      throw new Error(`GitHub authentication failed: ${error.message}`);
    }
  }

  /**
   * List user repositories
   */
  async listUserRepos(
    accessToken: string,
    options?: { page?: number; perPage?: number; sort?: 'created' | 'updated' | 'pushed' | 'full_name' }
  ): Promise<GitHubRepoInfo[]> {
    try {
      const octokit = this.getOctokit(accessToken);
      const { data } = await octokit.repos.listForAuthenticatedUser({
        page: options?.page || 1,
        per_page: options?.perPage || 30,
        sort: options?.sort || 'updated'
      });

      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url || '',
        sshUrl: repo.ssh_url || '',
        defaultBranch: repo.default_branch || 'main',
        private: repo.private,
        description: repo.description || undefined
      }));
    } catch (error: any) {
      logger.error('Failed to list repositories:', error);
      throw new Error(`Failed to list repositories: ${error.message}`);
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(
    accessToken: string,
    options: CreateRepoOptions
  ): Promise<GitHubRepoInfo> {
    try {
      const octokit = this.getOctokit(accessToken);

      logger.info(`Creating GitHub repository: ${options.name}`);

      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description || 'Created by OrbitAI',
        private: options.private ?? true,
        auto_init: options.autoInit ?? true,
        has_issues: options.hasIssues ?? true,
        has_projects: options.hasProjects ?? true,
        has_wiki: options.hasWiki ?? false
      });

      logger.info(`✅ Repository created: ${data.full_name}`);

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        htmlUrl: data.html_url,
        cloneUrl: data.clone_url || '',
        sshUrl: data.ssh_url || '',
        defaultBranch: data.default_branch || 'main',
        private: data.private,
        description: data.description || undefined
      };
    } catch (error: any) {
      logger.error('Failed to create repository:', error);
      if (error.status === 422) {
        throw new Error(`Repository "${options.name}" already exists`);
      }
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  }

  /**
   * Delete a repository
   */
  async deleteRepository(
    accessToken: string,
    owner: string,
    repo: string
  ): Promise<void> {
    try {
      const octokit = this.getOctokit(accessToken);
      await octokit.repos.delete({ owner, repo });
      logger.info(`Repository deleted: ${owner}/${repo}`);
    } catch (error: any) {
      logger.error('Failed to delete repository:', error);
      throw new Error(`Failed to delete repository: ${error.message}`);
    }
  }

  /**
   * Push files to a repository
   * Creates a new commit with all provided files
   */
  async pushFiles(
    accessToken: string,
    options: PushFilesOptions
  ): Promise<{ commitSha: string; commitUrl: string }> {
    try {
      const octokit = this.getOctokit(accessToken);
      const { owner, repo, branch = 'main', files, message } = options;

      logger.info(`Pushing ${files.length} files to ${owner}/${repo}:${branch}`);

      // Get the reference for the branch
      let baseSha: string;
      try {
        const { data: ref } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`
        });
        baseSha = ref.object.sha;
      } catch (error: any) {
        if (error.status === 404) {
          // Branch doesn't exist, create from default branch
          const { data: repoData } = await octokit.repos.get({ owner, repo });
          const { data: defaultRef } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${repoData.default_branch}`
          });
          baseSha = defaultRef.object.sha;

          // Create the new branch
          await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branch}`,
            sha: baseSha
          });
        } else {
          throw error;
        }
      }

      // Get the current commit tree
      const { data: baseCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: baseSha
      });

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async file => {
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64'
          });
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha
          };
        })
      );

      // Create a new tree
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseCommit.tree.sha,
        tree: blobs
      });

      // Create a new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message,
        tree: newTree.sha,
        parents: [baseSha]
      });

      // Update the reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      });

      logger.info(`✅ Pushed ${files.length} files to ${owner}/${repo}:${branch}`);

      return {
        commitSha: newCommit.sha,
        commitUrl: newCommit.html_url
      };
    } catch (error: any) {
      logger.error('Failed to push files:', error);
      throw new Error(`Failed to push files: ${error.message}`);
    }
  }

  /**
   * Push generated project files to a new or existing repository
   */
  async pushGeneratedProject(
    accessToken: string,
    projectName: string,
    files: GeneratedFile[],
    options?: {
      createRepo?: boolean;
      repoName?: string;
      private?: boolean;
      description?: string;
      branch?: string;
    }
  ): Promise<{ repo: GitHubRepoInfo; commitSha: string; commitUrl: string }> {
    try {
      const user = await this.getAuthenticatedUser(accessToken);
      const repoName = (options?.repoName || projectName)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      let repo: GitHubRepoInfo;

      // Check if repo exists or create new one
      if (options?.createRepo !== false) {
        try {
          repo = await this.createRepository(accessToken, {
            name: repoName,
            description: options?.description || `Generated by OrbitAI: ${projectName}`,
            private: options?.private ?? true,
            autoInit: true
          });
        } catch (error: any) {
          // If repo already exists, get it
          if (error.message.includes('already exists')) {
            const repos = await this.listUserRepos(accessToken);
            const existingRepo = repos.find(r => r.name === repoName);
            if (!existingRepo) {
              throw error;
            }
            repo = existingRepo;
          } else {
            throw error;
          }
        }
      } else {
        const repos = await this.listUserRepos(accessToken);
        const existingRepo = repos.find(r => r.name === repoName);
        if (!existingRepo) {
          throw new Error(`Repository ${repoName} not found`);
        }
        repo = existingRepo;
      }

      // Wait a moment for repo to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Push files
      const pushResult = await this.pushFiles(accessToken, {
        owner: user.login,
        repo: repo.name,
        branch: options?.branch || 'main',
        files: files.map(f => ({ path: f.path, content: f.content })),
        message: `feat: Initial project code generated by OrbitAI

Generated files:
${files.slice(0, 10).map(f => `- ${f.path}`).join('\n')}
${files.length > 10 ? `... and ${files.length - 10} more files` : ''}`
      });

      return {
        repo,
        ...pushResult
      };
    } catch (error: any) {
      logger.error('Failed to push generated project:', error);
      throw error;
    }
  }

  /**
   * Create GitHub Actions workflow file
   */
  async createWorkflow(
    accessToken: string,
    owner: string,
    repo: string,
    workflowName: string,
    config: WorkflowConfig
  ): Promise<{ path: string; sha: string }> {
    try {
      const octokit = this.getOctokit(accessToken);
      const path = `.github/workflows/${workflowName}.yml`;

      const yamlContent = this.generateWorkflowYaml(config);

      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `ci: Add ${workflowName} workflow`,
        content: Buffer.from(yamlContent).toString('base64')
      });

      logger.info(`✅ Created workflow: ${path}`);

      return {
        path,
        sha: data.commit.sha
      };
    } catch (error: any) {
      logger.error('Failed to create workflow:', error);
      throw new Error(`Failed to create workflow: ${error.message}`);
    }
  }

  /**
   * Generate CI/CD workflow for deployment
   */
  generateDeploymentWorkflow(
    platform: 'vercel' | 'railway' | 'render' | 'netlify' | 'aws' | 'gcp' | 'azure'
  ): WorkflowConfig {
    const baseConfig: WorkflowConfig = {
      name: `Deploy to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
      on: {
        push: { branches: ['main'] },
        workflow_dispatch: {}
      },
      jobs: {}
    };

    switch (platform) {
      case 'vercel':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              { uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
              { run: 'npm ci' },
              { run: 'npm run build' },
              {
                name: 'Deploy to Vercel',
                uses: 'amondnet/vercel-action@v25',
                with: {
                  'vercel-token': '${{ secrets.VERCEL_TOKEN }}',
                  'vercel-org-id': '${{ secrets.VERCEL_ORG_ID }}',
                  'vercel-project-id': '${{ secrets.VERCEL_PROJECT_ID }}',
                  'working-directory': './'
                }
              }
            ]
          }
        };
        break;

      case 'railway':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              {
                name: 'Install Railway CLI',
                run: 'npm install -g @railway/cli'
              },
              {
                name: 'Deploy to Railway',
                run: 'railway up --service ${{ secrets.RAILWAY_SERVICE }}',
                env: {
                  RAILWAY_TOKEN: '${{ secrets.RAILWAY_TOKEN }}'
                }
              }
            ]
          }
        };
        break;

      case 'render':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              {
                name: 'Deploy to Render',
                uses: 'johnbeynon/render-deploy-action@v0.0.8',
                with: {
                  'service-id': '${{ secrets.RENDER_SERVICE_ID }}',
                  'api-key': '${{ secrets.RENDER_API_KEY }}'
                }
              }
            ]
          }
        };
        break;

      case 'netlify':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              { uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
              { run: 'npm ci' },
              { run: 'npm run build' },
              {
                name: 'Deploy to Netlify',
                uses: 'nwtgck/actions-netlify@v2',
                with: {
                  'publish-dir': './dist',
                  'production-branch': 'main'
                },
                env: {
                  NETLIFY_AUTH_TOKEN: '${{ secrets.NETLIFY_AUTH_TOKEN }}',
                  NETLIFY_SITE_ID: '${{ secrets.NETLIFY_SITE_ID }}'
                }
              }
            ]
          }
        };
        break;

      case 'aws':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              {
                name: 'Configure AWS credentials',
                uses: 'aws-actions/configure-aws-credentials@v4',
                with: {
                  'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                  'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                  'aws-region': '${{ secrets.AWS_REGION }}'
                }
              },
              {
                name: 'Build Docker image',
                run: 'docker build -t ${{ secrets.ECR_REPOSITORY }} .'
              },
              {
                name: 'Login to ECR',
                run: 'aws ecr get-login-password | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}'
              },
              {
                name: 'Push image',
                run: 'docker push ${{ secrets.ECR_REPOSITORY }}'
              },
              {
                name: 'Deploy to App Runner',
                run: 'aws apprunner start-deployment --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }}'
              }
            ]
          }
        };
        break;

      case 'gcp':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              {
                name: 'Authenticate to Google Cloud',
                uses: 'google-github-actions/auth@v2',
                with: {
                  'credentials_json': '${{ secrets.GCP_SA_KEY }}'
                }
              },
              {
                name: 'Set up Cloud SDK',
                uses: 'google-github-actions/setup-gcloud@v2'
              },
              {
                name: 'Deploy to Cloud Run',
                run: `
                  gcloud run deploy \${{ secrets.SERVICE_NAME }} \
                    --source . \
                    --project \${{ secrets.GCP_PROJECT_ID }} \
                    --region \${{ secrets.GCP_REGION }} \
                    --allow-unauthenticated
                `
              }
            ]
          }
        };
        break;

      case 'azure':
        baseConfig.jobs = {
          deploy: {
            'runs-on': 'ubuntu-latest',
            steps: [
              { uses: 'actions/checkout@v4' },
              {
                name: 'Login to Azure',
                uses: 'azure/login@v1',
                with: {
                  creds: '${{ secrets.AZURE_CREDENTIALS }}'
                }
              },
              {
                name: 'Build and deploy',
                uses: 'azure/webapps-deploy@v2',
                with: {
                  'app-name': '${{ secrets.AZURE_WEBAPP_NAME }}',
                  'publish-profile': '${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}'
                }
              }
            ]
          }
        };
        break;
    }

    return baseConfig;
  }

  /**
   * Convert workflow config to YAML
   */
  private generateWorkflowYaml(config: WorkflowConfig): string {
    // Simple YAML generation (for production, use js-yaml library)
    const yaml = require('yaml');
    return yaml.stringify(config);
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    options: {
      title: string;
      body?: string;
      head: string;
      base?: string;
    }
  ): Promise<{ number: number; url: string }> {
    try {
      const octokit = this.getOctokit(accessToken);

      const { data } = await octokit.pulls.create({
        owner,
        repo,
        title: options.title,
        body: options.body || '',
        head: options.head,
        base: options.base || 'main'
      });

      logger.info(`✅ Created PR #${data.number}: ${data.title}`);

      return {
        number: data.number,
        url: data.html_url
      };
    } catch (error: any) {
      logger.error('Failed to create pull request:', error);
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  /**
   * Get user's GitHub access token from database
   */
  async getUserGitHubToken(userId: string): Promise<string | null> {
    try {
      const user = await User.findById(userId).select('integrations.github');
      return user?.integrations?.github?.accessToken || null;
    } catch (error) {
      logger.error('Failed to get user GitHub token:', error);
      return null;
    }
  }

  /**
   * Store user's GitHub access token
   */
  async storeUserGitHubToken(userId: string, accessToken: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        $set: {
          'integrations.github.accessToken': accessToken,
          'integrations.github.connectedAt': new Date()
        }
      });
      logger.info(`Stored GitHub token for user ${userId}`);
    } catch (error) {
      logger.error('Failed to store GitHub token:', error);
      throw error;
    }
  }
}

export const githubService = new GitHubService();
