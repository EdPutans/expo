/**
 * Copyright © 2022 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from 'assert';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import prettyBytes from 'pretty-bytes';
import { inspect } from 'util';

import { Log } from '../log';
import { DevServerManager } from '../start/server/DevServerManager';
import { MetroBundlerDevServer } from '../start/server/metro/MetroBundlerDevServer';
import { stripAnsi } from '../utils/ansi';

const debug = require('debug')('expo:export:generateStaticRoutes') as typeof console.log;

type Options = { outputDir: string; scripts: string[]; minify: boolean };

/** @private */
export async function unstable_exportStaticAsync(projectRoot: string, options: Options) {
  // NOTE(EvanBacon): Please don't use this feature.
  Log.warn('Static exporting with Metro is an experimental feature.');

  const devServerManager = new DevServerManager(projectRoot, {
    minify: options.minify,
    mode: 'production',
    location: {},
  });

  await devServerManager.startAsync([
    {
      type: 'metro',
    },
  ]);

  await exportFromServerAsync(devServerManager, options);

  await devServerManager.stopAsync();
}

async function getExpoRoutesAsync(devServerManager: DevServerManager) {
  const server = devServerManager.getDefaultDevServer();
  assert(server instanceof MetroBundlerDevServer);
  return server.getRoutesAsync();
}

/** Match `(page)` -> `page` */
function matchGroupName(name: string): string | undefined {
  return name.match(/^\(([^/]+?)\)$/)?.[1];
}

function appendScriptsToHtml(html: string, scripts: string[]) {
  return html.replace(
    '</body>',
    scripts.map((script) => `<script src="${script}" defer></script>`).join('') + '</body>'
  );
}

export async function getFilesToExportFromServerAsync({
  manifest,
  scripts,
  renderAsync,
}: {
  manifest: any;
  scripts: string[];
  renderAsync: (pathname: string) => Promise<{
    fetchData: boolean;
    scriptContents: string;
    renderAsync: () => any;
  }>;
}): Promise<Map<string, string>> {
  // name : contents
  const files = new Map<string, string>();

  const sanitizeName = (segment: string) => {
    // Strip group names from the segment
    return segment
      .split('/')
      .map((s) => (matchGroupName(s) ? '' : s))
      .filter(Boolean)
      .join('/');
  };

  const fetchScreens = (
    screens: Record<string, any>,
    additionPath: string = ''
  ): Promise<any>[] => {
    async function fetchScreenExactAsync(pathname: string, filename: string) {
      const outputPath = [additionPath, filename].filter(Boolean).join('/').replace(/^\//, '');
      // TODO: Ensure no duplicates in the manifest.
      if (files.has(outputPath)) {
        return;
      }

      // Prevent duplicate requests while running in parallel.
      files.set(outputPath, '');

      try {
        const data = await renderAsync(pathname);

        // if (data.fetchData) {
        //   // console.log('ssr:', pathname);
        // } else {
        files.set(outputPath, appendScriptsToHtml(data.renderAsync(), scripts));
        // }
      } catch (e: any) {
        // TODO: Format Metro error message better...
        Log.error('Failed to statically render route:', pathname);
        e.message = stripAnsi(e.message);
        Log.exception(e);
        throw e;
      }
    }

    async function fetchScreenAsync({ segment, filename }: { segment: string; filename: string }) {
      // Strip group names from the segment
      const cleanSegment = sanitizeName(segment);

      if (cleanSegment !== segment) {
        // has groups, should request multiple screens.
        await fetchScreenExactAsync(
          [additionPath, segment].filter(Boolean).join('/'),
          [additionPath, filename].filter(Boolean).join('/').replace(/^\//, '')
        );
      }

      await fetchScreenExactAsync(
        [additionPath, cleanSegment].filter(Boolean).join('/'),
        [additionPath, sanitizeName(filename)].filter(Boolean).join('/').replace(/^\//, '')
      );
    }

    return Object.entries(screens).map(async ([name, segment]) => {
      const filename = name + '.html';

      // Segment is a directory.
      if (typeof segment !== 'string') {
        if (Object.keys(segment.screens).length) {
          const cleanSegment = sanitizeName(segment.path);
          return Promise.all(
            fetchScreens(segment.screens, [additionPath, cleanSegment].filter(Boolean).join('/'))
          );
        } else {
          segment = segment.path;
        }
      }

      // TODO: handle dynamic routes
      // if (!segment.startsWith('*')) {
      await fetchScreenAsync({ segment, filename });
      // }
      return null;
    });
  };

  await Promise.all(fetchScreens(manifest.screens));

  return files;
}

/** Perform all fs commits */
export async function exportFromServerAsync(
  devServerManager: DevServerManager,
  { outputDir, scripts }: Options
): Promise<void> {
  const devServer = devServerManager.getDefaultDevServer();
  assert(devServer instanceof MetroBundlerDevServer);

  const manifest = await getExpoRoutesAsync(devServerManager);
  debug('Routes:\n', inspect(manifest, { colors: true, depth: null }));

  const files = await getFilesToExportFromServerAsync({
    manifest,
    scripts,
    renderAsync(pathname: string) {
      assert(devServer instanceof MetroBundlerDevServer);
      return devServer.getStaticPageAsync(pathname, { mode: 'production' });
    },
  });

  const [routesManifest, middleware] = await devServer.getFunctionsAsync({ mode: 'production' });

  const staticDir = path.join(outputDir);
  fs.mkdirSync(path.join(staticDir), { recursive: true });

  const funcDir = path.join(outputDir, '.expo/functions');
  fs.mkdirSync(path.join(funcDir), { recursive: true });

  await fs.promises.writeFile(
    path.join(outputDir, '.expo/routes.json'),
    JSON.stringify(routesManifest, null, 2),
    'utf-8'
  );

  await Promise.all(
    Object.entries(middleware)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([file, contents]) => {
        const length = Buffer.byteLength(contents, 'utf8');
        Log.log(file, chalk.gray`(${prettyBytes(length)})`);
        const outputPath = path.join(funcDir, file);
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.promises.writeFile(outputPath.replace(/\.[tj]sx?$/, '.js'), contents);
      })
  );

  Log.log(`Exporting ${files.size} files:`);
  await Promise.all(
    [...files.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([file, contents]) => {
        const length = Buffer.byteLength(contents, 'utf8');
        Log.log(file, chalk.gray`(${prettyBytes(length)})`);
        const outputPath = path.join(staticDir, file);
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.promises.writeFile(outputPath, contents);
      })
  );
}
