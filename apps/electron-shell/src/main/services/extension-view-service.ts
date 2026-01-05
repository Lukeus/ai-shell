/**
 * ExtensionViewService - Aggregates and manages extension-contributed views.
 * 
 * P1 (Process isolation): View rendering executes in Extension Host, not main process.
 * P2 (Security): Renderer communicates via IPC only, never directly to Extension Host.
 */

import { ExtensionHostManager } from './extension-host-manager';

/**
 * Registered view metadata.
 */
export interface RegisteredView {
  viewId: string;
  name: string;
  location: 'primary-sidebar' | 'secondary-sidebar' | 'panel';
  icon?: string;
  extensionId: string;
}

type ExtensionActivationHandler = (extensionId: string, event?: string) => Promise<void>;

/**
 * View rendering result.
 */
export interface ViewRenderResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * ExtensionViewService manages view registration and rendering.
 */
export class ExtensionViewService {
  private extensionHostManager: ExtensionHostManager;
  private views: Map<string, RegisteredView>;
  private activateExtension?: ExtensionActivationHandler;

  constructor(
    extensionHostManager: ExtensionHostManager,
    activateExtension?: ExtensionActivationHandler
  ) {
    this.extensionHostManager = extensionHostManager;
    this.views = new Map();
    this.activateExtension = activateExtension;
  }

  /**
   * Register a view from an extension.
   * Called by ExtensionHostManager when extensions register views.
   */
  registerView(view: RegisteredView): void {
    if (this.views.has(view.viewId)) {
      console.warn(`[ExtensionViewService] View ${view.viewId} already registered, overwriting`);
    }

    this.views.set(view.viewId, view);
    console.log(`[ExtensionViewService] Registered view ${view.viewId} from ${view.extensionId}`);
  }

  /**
   * Unregister views from an extension.
   */
  unregisterExtensionViews(extensionId: string): void {
    const toRemove: string[] = [];
    
    for (const [viewId, view] of this.views.entries()) {
      if (view.extensionId === extensionId) {
        toRemove.push(viewId);
      }
    }

    for (const viewId of toRemove) {
      this.views.delete(viewId);
    }

    if (toRemove.length > 0) {
      console.log(`[ExtensionViewService] Unregistered ${toRemove.length} views from ${extensionId}`);
    }
  }

  /**
   * Render a view by ID.
   * Routes rendering to Extension Host via JSON-RPC.
   * 
   * @param viewId - View ID to render
   * @returns View content (HTML string)
   */
  async renderView(viewId: string): Promise<ViewRenderResult> {
    const view = this.views.get(viewId);
    
    if (!view) {
      return {
        success: false,
        error: `View not found: ${viewId}`,
      };
    }

    try {
      if (this.activateExtension) {
        await this.activateExtension(view.extensionId, `onView:${viewId}`);
      }

      // Request view rendering from Extension Host
      const content = await this.extensionHostManager.sendRequest('view.render', {
        viewId,
      });

      // Task 8 invariant: View content sanitized before rendering in renderer
      // Content validation happens here before passing to renderer
      if (typeof content !== 'string') {
        throw new Error('View must return string content');
      }

      return {
        success: true,
        content: content as string,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[ExtensionViewService] View rendering failed for ${viewId}:`, error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * List all registered views.
   */
  listViews(): RegisteredView[] {
    return Array.from(this.views.values());
  }

  /**
   * Reset all registered views (used during contribution sync).
   */
  reset(): void {
    this.views.clear();
  }

  /**
   * Get views by location.
   */
  getViewsByLocation(location: 'primary-sidebar' | 'secondary-sidebar' | 'panel'): RegisteredView[] {
    return Array.from(this.views.values()).filter(view => view.location === location);
  }

  /**
   * Get view by ID.
   */
  getView(viewId: string): RegisteredView | undefined {
    return this.views.get(viewId);
  }

  /**
   * Check if a view is registered.
   */
  hasView(viewId: string): boolean {
    return this.views.has(viewId);
  }
}
