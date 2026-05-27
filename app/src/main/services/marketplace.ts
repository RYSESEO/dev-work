import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';
import {
  createId,
  nowIso,
  type MarketplaceEntry,
  type PluginDefinition,
  type PluginHook
} from '../../shared/domain.js';

const log = logger.child('marketplace');

export interface PackageManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'runner' | 'plugin';
  runnerType: string | null;
  tags: string[];
  entryPoint: string;
  hooks?: PluginHook[];
  config?: Record<string, string>;
}

export interface MarketplaceService {
  installEntry(entryId: string): MarketplaceEntry;
  uninstallEntry(entryId: string): void;
  registerPackage(manifest: PackageManifest): MarketplaceEntry;
  getInstalledPlugins(): PluginDefinition[];
  getPackageDir(): string;
}

export function createMarketplaceService(store: AppStore, packagesDir: string): MarketplaceService {
  return {
    installEntry(entryId: string): MarketplaceEntry {
      const entry = store.getById<MarketplaceEntry>('marketplace', entryId);
      if (!entry) throw new Error(`Marketplace entry not found: ${entryId}`);
      if (entry.installed) throw new Error(`${entry.name} is already installed.`);

      const updated = { ...entry, installed: true, updatedAt: nowIso() };
      store.put('marketplace', entry.id, updated);

      if (entry.category === 'plugin') {
        const plugin: PluginDefinition = {
          id: createId('plugin'),
          name: entry.name,
          description: entry.description,
          version: entry.version,
          author: entry.author,
          enabled: true,
          entryPoint: path.join(packagesDir, entry.id, 'index.js'),
          hooks: (entry.config?.hooks as unknown as PluginHook[]) ?? [],
          config: entry.config ?? {},
          installedAt: nowIso()
        };
        store.put('plugins', plugin.id, plugin);
        log.info('Plugin registered from marketplace install', { pluginId: plugin.id, name: entry.name });
      }

      log.info('Marketplace entry installed', { entryId, name: entry.name });
      return updated;
    },

    uninstallEntry(entryId: string): void {
      const entry = store.getById<MarketplaceEntry>('marketplace', entryId);
      if (!entry) throw new Error(`Marketplace entry not found: ${entryId}`);
      if (!entry.installed) throw new Error(`${entry.name} is not installed.`);

      store.put('marketplace', entry.id, { ...entry, installed: false, updatedAt: nowIso() });

      if (entry.category === 'plugin') {
        const plugins = store.getAll<PluginDefinition>('plugins');
        const plugin = plugins.find((p) => p.name === entry.name);
        if (plugin) {
          store.remove('plugins', plugin.id);
          log.info('Plugin removed from marketplace uninstall', { pluginId: plugin.id });
        }
      }

      log.info('Marketplace entry uninstalled', { entryId, name: entry.name });
    },

    registerPackage(manifest: PackageManifest): MarketplaceEntry {
      const existing = store.getAll<MarketplaceEntry>('marketplace')
        .find((e) => e.name === manifest.name);

      if (existing) {
        const updated: MarketplaceEntry = {
          ...existing,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          tags: manifest.tags,
          config: manifest.config ?? {},
          updatedAt: nowIso()
        };
        store.put('marketplace', existing.id, updated);
        log.info('Marketplace entry updated', { id: existing.id, name: manifest.name, version: manifest.version });
        return updated;
      }

      const at = nowIso();
      const entry: MarketplaceEntry = {
        id: createId('plugin'),
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        category: manifest.category,
        runnerType: manifest.runnerType,
        tags: manifest.tags,
        installed: false,
        rating: 0,
        downloads: 0,
        config: manifest.config ?? {},
        createdAt: at,
        updatedAt: at
      };
      store.put('marketplace', entry.id, entry);
      log.info('Marketplace entry registered', { id: entry.id, name: manifest.name });
      return entry;
    },

    getInstalledPlugins(): PluginDefinition[] {
      return store.getAll<PluginDefinition>('plugins').filter((p) => p.enabled);
    },

    getPackageDir(): string {
      void fs.mkdir(packagesDir, { recursive: true });
      return packagesDir;
    }
  };
}
