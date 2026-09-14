#!/usr/bin/env tsx

/**
 * Production deployment setup script.
 * Handles complete production setup including Convex and Netlify deployment.
 * Run: pnpm run setup:prod
 */

import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

function getProductionConvexEnvironmentVariable(name: string): string | null {
  const result = spawnSync('npx', ['convex', 'env', 'get', name, '--prod'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error || result.status !== 0) {
    throw new Error(`Could not inspect production ${name}. Refusing to change it.`);
  }

  const value = result.stdout.trim();
  if (value) return value;

  if (result.stderr.includes(`Environment variable "${name}" not found.`)) {
    return null;
  }

  throw new Error(`Convex did not return a usable value for production ${name}.`);
}

function setProductionConvexEnvironmentVariable(name: string, value: string) {
  execFileSync('npx', ['convex', 'env', 'set', name, value, '--prod'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
}

// Helper functions for user input
async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

async function askInput(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setupConvexProduction(): Promise<{
  convexUrl: string;
  deploymentName: string;
  deployOutput: string;
} | null> {
  console.log('\n🚀 Setting up Convex production...');

  console.log('\n⚙️  Setting production environment variables...');

  const deployedAuthSecret = getProductionConvexEnvironmentVariable('BETTER_AUTH_SECRET');
  if (deployedAuthSecret) {
    console.log('   BETTER_AUTH_SECRET already exists; leaving it unchanged.');
  } else {
    const generatedAuthSecret = execFileSync('openssl', ['rand', '-base64', '32'], {
      encoding: 'utf8',
    }).trim();
    console.log('   Setting BETTER_AUTH_SECRET for the first time...');
    setProductionConvexEnvironmentVariable('BETTER_AUTH_SECRET', generatedAuthSecret);
  }

  // Set production environment variables
  const prodEnvVars = [
    { name: 'APP_NAME', value: 'Firesales' },
    { name: 'RESEND_EMAIL_SENDER', value: 'onboarding@resend.dev' },
  ];

  for (const { name, value } of prodEnvVars) {
    try {
      console.log(`   Setting ${name}...`);
      setProductionConvexEnvironmentVariable(name, value);
    } catch {
      console.log(`   ⚠️  Failed to set ${name}`);
    }
  }

  console.log('\n🚀 Deploying to Convex production...');
  try {
    // Actually deploy to production and capture the deployment URL
    const deployOutput = execSync('npx convex deploy --yes 2>&1', {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'inherit'], // Show progress, capture stdout, show stderr
    });

    console.log('✅ Convex production deployment complete!\n', deployOutput);

    // Extract production deployment info from the output
    // Look for the deployment URL in the success message
    const urlIndex = deployOutput.indexOf('https://');
    if (urlIndex !== -1) {
      const urlStart = deployOutput.substring(urlIndex);
      const urlEnd = urlStart.indexOf('\n') !== -1 ? urlStart.indexOf('\n') : urlStart.length;
      const url = urlStart.substring(0, urlEnd).trim();
      const deploymentMatch = url.match(/https:\/\/([a-z0-9-]+)\.convex\.cloud/);
      if (deploymentMatch) {
        const deploymentName = deploymentMatch[1];
        const convexUrl = `https://${deploymentName}.convex.cloud`;
        return { convexUrl, deploymentName, deployOutput };
      }
    }

    return null;
  } catch (_error) {
    console.log('❌ Convex deployment failed. You can try again later with: npx convex deploy');
    console.log('   Make sure you have the correct permissions and environment variables set.');
    throw new Error('Convex deployment failed');
  }
}

async function main() {
  try {
    // Confirm they want to proceed
    const shouldContinue = await askYesNo('Ready to set up production deployment? (y/N): ');
    if (!shouldContinue) {
      console.log('👋 Setup cancelled.');
      return;
    }

    // Step 1: Setup Convex production
    const convexInfo = await setupConvexProduction();
    if (!convexInfo) {
      console.log(
        '⚠️  Could not determine Convex deployment information. Continuing with manual setup...',
      );
    }

    // Step 2: Setup Netlify deployment
    console.log('\n🌐 Netlify Deployment Setup');
    console.log('────────────────────────────');

    console.log('📋 Complete these steps to deploy to Netlify:');
    console.log('');

    // Get the values for the environment variables
    let convexUrl = '';
    let convexSiteUrl = '';

    if (convexInfo?.convexUrl) {
      convexUrl = convexInfo.convexUrl;
      convexSiteUrl = convexInfo.convexUrl.replace('.convex.cloud', '.convex.site');
    } else {
      // Try to get production deployment name from convex deploy output
      try {
        const deployOutput = execSync('echo "n" | npx convex deploy', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
        });

        // Extract deployment name from output like "Your prod deployment accomplished-lyrebird-287 serves traffic at:"
        const deploymentMatch = deployOutput.match(
          /Your prod deployment ([a-z-]+-[0-9]+) serves traffic at:/,
        );
        if (deploymentMatch) {
          const deploymentName = deploymentMatch[1];
          convexUrl = `https://${deploymentName}.convex.cloud`;
          convexSiteUrl = `https://${deploymentName}.convex.site`;
        } else {
          throw new Error('Could not extract deployment name from convex deploy output');
        }
      } catch {
        // Final fallback
        convexUrl = 'https://your-deployment.convex.cloud';
        convexSiteUrl = 'https://your-deployment.convex.site';
      }
    }

    // Get the repository URL for instructions
    let repoUrl: string;
    try {
      const gitRemote = execSync('git config --get remote.origin.url', {
        encoding: 'utf8',
        cwd: process.cwd(),
      }).trim();

      // Convert SSH URL to HTTPS if needed
      if (gitRemote.startsWith('git@')) {
        repoUrl = gitRemote.replace('git@github.com:', 'https://github.com/').replace('.git', '');
      } else if (gitRemote.startsWith('https://')) {
        repoUrl = gitRemote.replace('.git', '');
      } else {
        throw new Error('Unsupported git remote format');
      }
    } catch {
      repoUrl = 'your GitHub repository URL';
    }

    console.log('1. Go to https://app.netlify.com/start');
    console.log('2. Click "Deploy manually" (do not use a template)');
    console.log('3. Connect your GitHub account and select your repository:');
    console.log(`   ${repoUrl}`);
    console.log('4. Netlify will detect your netlify.toml file automatically');
    console.log('5. On the environment variables step, provide these values:');
    console.log('');
    console.log(
      '   BETTER_AUTH_SECRET = use the existing production secret. Retrieve it securely with:',
    );
    console.log('     npx convex env get BETTER_AUTH_SECRET --prod');
    console.log(`   VITE_CONVEX_URL = ${convexUrl}`);
    console.log(`   VITE_CONVEX_SITE_URL = ${convexSiteUrl}`);
    console.log('');
    console.log('   For CONVEX_DEPLOY_KEY:');
    console.log('   1. Go to https://dashboard.convex.dev');
    console.log('   2. Select your project');
    console.log('   3. Go to Settings → Deploy Keys');
    console.log('   4. Click "Generate Production Deploy Key"');
    console.log('   5. Copy the key (starts with "prod:")');
    console.log('');
    console.log(
      '6. Netlify will pre-fill the build command and publish directory from netlify.toml.',
    );
    console.log('7. Click "Deploy site"');
    console.log('');
    console.log('💡 Your site will be live at: https://your-site-name.netlify.app');

    const rawNetlifySiteUrl = (
      await askInput('\nEnter your Netlify production URL (e.g. https://your-site.netlify.app): ')
    ).trim();
    if (!rawNetlifySiteUrl) {
      console.log('⚠️ Skipping BETTER_AUTH_SITE_URL setup (no URL provided). You can run');
      console.log(
        '   npx convex env set BETTER_AUTH_SITE_URL https://your-site.netlify.app --prod',
      );
    } else {
      const normalizedUrl = (() => {
        const candidate = /^https?:\/\//i.test(rawNetlifySiteUrl)
          ? rawNetlifySiteUrl
          : `https://${rawNetlifySiteUrl}`;
        try {
          return new URL(candidate).origin;
        } catch {
          console.log(
            `⚠️ Could not parse "${rawNetlifySiteUrl}" as a URL. Skipping BETTER_AUTH_SITE_URL setup.`,
          );
          return null;
        }
      })();

      if (normalizedUrl) {
        try {
          console.log(`\n🔐 Setting BETTER_AUTH_SITE_URL to ${normalizedUrl}...`);
          setProductionConvexEnvironmentVariable('BETTER_AUTH_SITE_URL', normalizedUrl);
          console.log('✅ BETTER_AUTH_SITE_URL configured in Convex production environment.');
        } catch {
          console.log(
            '⚠️ Failed to set BETTER_AUTH_SITE_URL. You may need additional permissions or can try again later with:',
          );
          console.log(`   npx convex env set BETTER_AUTH_SITE_URL "${normalizedUrl}" --prod`);
        }
      }
    }

    console.log('\n🎊 All done! Your app is now live in production!');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.log('\n💡 You can retry individual steps:');
    console.log('   • Convex: npx convex deploy');
    console.log('   • Netlify: netlify deploy --prod');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
