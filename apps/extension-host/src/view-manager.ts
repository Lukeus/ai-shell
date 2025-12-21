/**
 * ViewManager - Manages view registration in Extension Host.
 * 
 * P1 (Process Isolation): Runs in Extension Host process only.
 * Views are registered by extensions and metadata synced to main process.
 */

/**
 * View provider function type.
 * Extensions provide content for their views through this function.
 */
export type ViewProvider = () => string | Promise<string>;

/**
 * Registered view.
 */
interface RegisteredView {
  id: string;
  provider: ViewProvider;
  extensionId: string;
}

/**
 * ViewManager tracks view registrations and handles content rendering.
 */
export class ViewManager {
  private views: Map<string, RegisteredView>;

  constructor() {
    this.views = new Map();
  }

  /**
   * Register a view provider from an extension.
   * 
   * @param viewId - Unique view ID
   * @param provider - Function that returns view content
   * @param extensionId - ID of the extension registering the view
   */
  registerView(viewId: string, provider: ViewProvider, extensionId: string): void {
    if (this.views.has(viewId)) {
      console.warn(`[ViewManager] View ${viewId} already registered, overwriting`);
    }

    this.views.set(viewId, {
      id: viewId,
      provider,
      extensionId,
    });

    console.log(`[ViewManager] Registered view ${viewId} from ${extensionId}`);
  }

  /**
   * Unregister views from an extension.
   * 
   * @param extensionId - Extension ID
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
      console.log(`[ViewManager] Unregistered ${toRemove.length} views from ${extensionId}`);
    }
  }

  /**
   * Render a view by ID.
   * Calls the view's provider function to get content.
   * 
   * @param viewId - View ID to render
   * @returns View content (HTML string)
   */
  async renderView(viewId: string): Promise<string> {
    const view = this.views.get(viewId);

    if (!view) {
      throw new Error(`View not found: ${viewId}`);
    }

    try {
      console.log(`[ViewManager] Rendering view ${viewId} from ${view.extensionId}`);
      
      const content = await view.provider();
      
      // Task 8 invariant: View content sanitized before rendering
      // For now, we'll just ensure it's a string. Proper sanitization happens in renderer.
      if (typeof content !== 'string') {
        throw new Error('View provider must return a string');
      }
      
      return content;
    } catch (error) {
      console.error(`[ViewManager] View rendering failed for ${viewId}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered view IDs.
   */
  getViewIds(): string[] {
    return Array.from(this.views.keys());
  }

  /**
   * Check if a view is registered.
   */
  hasView(viewId: string): boolean {
    return this.views.has(viewId);
  }

  /**
   * Get view metadata for all views from an extension.
   */
  getExtensionViews(extensionId: string): Array<{ id: string }> {
    const result: Array<{ id: string }> = [];

    for (const [id, view] of this.views.entries()) {
      if (view.extensionId === extensionId) {
        result.push({ id });
      }
    }

    return result;
  }
}
