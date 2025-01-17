import * as path from 'node:path';
import { MonorepoTsProject, NxProject } from '@aws/pdk/monorepo';
import { javascript } from 'projen';
import { AwsCdkTypeScriptApp } from 'projen/lib/awscdk';
import { GalileoCdk, GalileoSdk } from '../framework';
import { LAMBDA_RECOGNIZE_LAYER_VERSION } from 'aws-cdk-lib/cx-api';
import { Api } from './api';
import { Corpus } from './corpus';
import { Website } from './website';
import { Sample } from './sample';
import { DEFAULT_RELEASE_BRANCH, VERSIONS } from '../constants';
import { EULA_ENABLED_CONTEXT } from '../../packages/galileo-cdk/src/ai/llms/framework/eula/context';
import { IApplicationContext } from '../../packages/galileo-cdk/src/core/app/context';
import { extractPeerDeps } from '../helpers/extract-peer-deps';

export interface InfraOptions {
  readonly monorepo: MonorepoTsProject;
  readonly rootOutdir: string;
  readonly galileoCdkLib: GalileoCdk;
  readonly galileoSdk: GalileoSdk;
  readonly api: Api;
  readonly corpus: Corpus;
  readonly website: Website;
  readonly sample: Sample;
}

export class Infra {
  public readonly project: AwsCdkTypeScriptApp;

  constructor(options: InfraOptions) {
    const { monorepo, rootOutdir, galileoSdk, galileoCdkLib, api, corpus, website, sample } = options;

    this.project = new AwsCdkTypeScriptApp({
      packageManager: javascript.NodePackageManager.PNPM,
      parent: monorepo,
      prettier: true,
      outdir: path.join(rootOutdir, 'infra'),
      cdkVersion: VERSIONS.CDK,
      constructsVersion: VERSIONS.CONSTRUCTS,
      defaultReleaseBranch: DEFAULT_RELEASE_BRANCH,
      npmignoreEnabled: false,
      name: 'infra',
      deps: [
        `@aws-cdk/aws-cognito-identitypool-alpha@^${VERSIONS.CDK}-alpha.0`,
        `@aws-cdk/aws-lambda-python-alpha@^${VERSIONS.CDK}-alpha.0`,
        '@aws-sdk/client-codebuild',
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-service-quotas',
        '@aws-sdk/client-sfn',
        '@aws-sdk/lib-dynamodb',
        `@aws/pdk@^${VERSIONS.PDK}`,
        '@aws-lambda-powertools/logger',
        '@aws-lambda-powertools/metrics',
        '@aws-lambda-powertools/parameters',
        '@middy/core',
        '@middy/error-logger',
        '@middy/http-router',
        '@middy/input-output-logger',
        'aws-lambda',
        'aws-jwt-verify',
        'case',
        'cdk-monitoring-constructs',
        'cdk-nag',
        'fs-extra',
        'lodash',
        'pretty-bytes',
        'readline-sync',
        'shorthash2',
        'uuid',
        // Workspace dependencies
        api.apiInterceptorsTs.package.packageName,
        api.project.infrastructure.typescript!.package.packageName,
        api.project.runtime.typescript!.package.packageName,

        // wsApi
        api.wsApiProject.infrastructure.typescript!.package.packageName,
        api.wsApiProject.runtime.typescript!.package.packageName,
        api.wsApiProject.handlers.typescript!.package.packageName,

        // For lambdas to reuse logic in step function
        corpus.logic.package.packageName,
        ...extractPeerDeps(corpus.logic),
        galileoSdk.package.packageName,
        ...extractPeerDeps(galileoSdk),
        galileoCdkLib.package.packageName,
        
        // Remove this if not using sample dataset
        sample.project.package.packageName,
        
        website.project.package.packageName,
      ],
      devDeps: [
        '@aws-sdk/types',
        '@smithy/types',
        '@types/aws-lambda',
        '@types/fs-extra',
        '@types/lodash',
        '@types/readline-sync',
        '@types/uuid',
        'aws-sdk',
        'tsconfig-paths',
      ],
      context: {
        // Automatically update lambda description with asset hash to ensure new versions are deployed
        [LAMBDA_RECOGNIZE_LAYER_VERSION]: true,
        // CICD CodeCommit repository name
        repositoryName: 'galileo',
        // Indicates if LLM End-User License Agreement verification is enabled
        [EULA_ENABLED_CONTEXT]: false, // TODO: Re-enable EULA for beta
        ...({
          websiteContentPath: path.relative(
            path.join(options.monorepo.outdir, rootOutdir, 'infra'),
            path.join(website.project.outdir, 'build'),
          ),
          corpusDockerImagePath: path.relative(
            path.join(options.monorepo.outdir, rootOutdir, 'infra'),
            path.join(corpus.dockerOutdir),
          ),
        } as IApplicationContext),
      },
      tsconfigDev: {
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
      tsconfig: {
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
          lib: ['ES2020'],
          target: 'ES2020',
          baseUrl: '.',
          paths: {
            '@aws/galileo-cdk/*': ['@aws/galileo-cdk/*', 'src/galileo/*'],
          },
        },
      },
    });
    this.project.gitignore.exclude('config*.json');
    this.project.gitignore.exclude('cdk.context.json');
    this.project.eslint?.addIgnorePattern('cdk.out');
    this.project.eslint?.addIgnorePattern('node_modules');
    this.project.eslint?.addIgnorePattern('test_reports');

    this.project.tryFindObjectFile('tsconfig.json')?.addOverride('ts-node', {
      require: ['tsconfig-paths/register'],
    });

    // infra/cdk.out/assets grows to big to cache, so disabling caching for this package
    // https://github.com/nrwl/nx/issues/17443#issuecomment-1581537253
    NxProject.ensure(this.project).setTarget('build', {
      dependsOn: ['^build'],
      inputs: [{ runtime: 'date +%s' }],
      outputs: [],
    });

    // Make sure that infra wait for python deps of the lambda handlers it contains
    NxProject.ensure(this.project).addImplicitDependency(api.project.runtime.python!, corpus.logic);

    this.project.package.setScript(
      'deploy:pipeline',
      'pnpm exec cdk deploy --app cdk.out --require-approval never PipelineStack',
    );

    this.project.package.setScript('nag', 'SKIP_BUNDLING=1 pnpm exec cdk synth --no-staging --strict --quiet');

    this.project.addTask('compile:watch', {
      exec: `pnpm exec tsc --noEmit --skipLibCheck --watch --project ${this.project.tsconfigDev.fileName}`,
    });
  }
}
