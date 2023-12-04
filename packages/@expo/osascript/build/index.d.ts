/// <reference types="ts-declarations" />
import { SpawnOptions, SpawnResult } from '@expo/spawn-async';
import { ExecAsyncOptions } from 'exec-async';
declare function osascriptExecAsync(script: string | string[], opts?: ExecAsyncOptions): Promise<string>;
declare function osascriptSpawnAsync(script: string | string[], opts?: SpawnOptions): Promise<SpawnResult>;
declare function isAppRunningAsync(appName: string): Promise<boolean>;
declare function safeIdOfAppAsync(appName: string): Promise<string | null>;
declare function openFinderToFolderAsync(dir: string, activate?: boolean): Promise<void>;
declare function openInAppAsync(appName: string, pth: string): Promise<SpawnResult>;
declare function chooseAppAsync(listOfAppNames: string[]): Promise<string | null>;
declare function chooseEditorAppAsync(preferredEditor?: string): Promise<string | null>;
declare function chooseTerminalAppAsync(): Promise<string | null>;
declare function openInEditorAsync(pth: string, preferredEditor?: string): Promise<SpawnResult>;
declare function openItermToSpecificFolderAsync(dir: string): Promise<SpawnResult>;
declare function openTerminalToSpecificFolderAsync(dir: string, inTab?: boolean): Promise<SpawnResult>;
declare function openFolderInTerminalAppAsync(dir: string, inTab?: boolean): Promise<SpawnResult>;
export { chooseAppAsync, chooseEditorAppAsync, chooseTerminalAppAsync, osascriptExecAsync as execAsync, isAppRunningAsync, openFinderToFolderAsync, openFolderInTerminalAppAsync, openInAppAsync, openInEditorAsync, openItermToSpecificFolderAsync, openTerminalToSpecificFolderAsync, safeIdOfAppAsync, osascriptSpawnAsync as spawnAsync, };
