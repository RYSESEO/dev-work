import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';
import type { PluginDefinition, PluginHook } from '../../shared/domain.js';

const log = logger.child('plugin-runtime');

export interface PluginContext {
  runId?: string;
  taskId?: string;
  missionId?: string;
  artifactId?: string;
  approvalId?: string;
  [key: string]: unknown;
}

export interface PluginRuntime {
  invokeHook(hook: PluginHook, context: PluginContext): Promise<void>;
  getActivePlugins(): PluginDefinition[];
}

export function createPluginRuntime(store: AppStore): PluginRuntime {
  return {
    async invokeHook(hook: PluginHook, context: PluginContext): Promise<void> {
      const plugins = store.getAll<PluginDefinition>('plugins').filter((p) => p.enabled && p.hooks.includes(hook));
      if (plugins.length === 0) return;

      log.info('Invoking plugin hook', { hook, pluginCount: plugins.length, context });

      for (const plugin of plugins) {
        try {
          log.info(`Plugin ${plugin.name} hook ${hook} invoked`, {
            pluginId: plugin.id,
            hook,
            context
          });
        } catch (err) {
          log.error(`Plugin ${plugin.name} hook ${hook} failed`, {
            pluginId: plugin.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    },

    getActivePlugins(): PluginDefinition[] {
      return store.getAll<PluginDefinition>('plugins').filter((p) => p.enabled);
    }
  };
}
