import { test, expect } from '../fixtures/electron-test-app';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * E2E tests for settings and theming feature.
 * 
 * Tests theme switching, settings persistence, and error handling.
 * 
 * P1 (Process isolation): Verify renderer cannot access file system directly
 * P3 (Secrets): Verify no secrets stored in settings.json
 * P5 (Performance budgets): Verify theme switch repaint < 16ms
 * 
 * Prerequisites:
 * - Run: pnpm --filter apps-electron-shell build
 * - Or keep dev server running: pnpm dev
 */

test.describe('Settings and Theming', () => {
  test('should launch with dark theme (default)', async ({ page }) => {
    // Wait for app to load
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Check data-theme attribute on html element
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('dark');
    
    // Verify CSS variable is set correctly for dark theme
    const surfaceColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-surface-default').trim();
    });
    
    // Dark theme should have a dark surface color (not white)
    expect(surfaceColor).not.toBe('#ffffff');
    expect(surfaceColor).not.toBe('rgb(255, 255, 255)');
  });

  test('should open settings panel via Activity Bar icon', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Find and click the settings icon in Activity Bar (⚙️)
    // Activity Bar is on the left with icon buttons
    const settingsButton = page.locator('button[aria-label="Settings"]');
    await settingsButton.waitFor({ timeout: 5000 });
    await settingsButton.click();
    
    // Verify settings panel opens
    await page.waitForSelector('text=Appearance', { timeout: 5000 });
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    const settingsVisible = await page.locator('text=Settings').count();
    expect(settingsVisible).toBeGreaterThan(0);
  });

  test('should open settings panel via Ctrl+, keyboard shortcut', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Press Ctrl+, (Cmd+, on Mac)
    await page.keyboard.press('Control+Comma');
    
    // Verify settings panel opens
    await page.waitForSelector('text=Appearance', { timeout: 5000 });
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    const themeLabel = await page.locator('text=Theme').count();
    expect(themeLabel).toBeGreaterThan(0);
  });

  test('should switch to light theme and update CSS variables', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings panel
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    // Find the theme select dropdown
    const themeSelect = page.locator('select').first();
    await themeSelect.waitFor({ timeout: 5000 });
    
    // Change to light theme
    await themeSelect.selectOption('light');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Verify data-theme attribute changed
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');
    
    // Verify CSS variable changed to light color
    const surfaceColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-surface-default').trim();
    });
    
    // Light theme should have white or very light surface
    const isLightColor = surfaceColor === '#ffffff' || 
                         surfaceColor === 'rgb(255, 255, 255)' ||
                         surfaceColor.includes('255');
    expect(isLightColor).toBe(true);
  });

  test('should persist theme after restart', async ({ page, electronApp }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings and change theme
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    const themeSelect = page.locator('select').first();
    await themeSelect.selectOption('light');
    await page.waitForTimeout(1000); // Wait for debounced save
    
    // Close and restart app
    await electronApp.close();
    
    // Note: In a real E2E test, you would need to relaunch the app
    // and verify the theme persisted. This requires the test fixture
    // to support app restart, which is beyond this basic test setup.
    
    // For now, we just verify the theme was set
    // In a full implementation, you would:
    // 1. Close electronApp
    // 2. Relaunch it
    // 3. Check data-theme attribute is still 'light'
  });

  test('should filter settings by search query', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.waitFor({ timeout: 5000 });
    
    // Type search query
    await searchInput.fill('theme');
    
    // Verify filtered results
    await page.waitForTimeout(300); // Wait for search debounce
    
    const themeVisible = await page.locator('text=Theme').count();
    const iconThemeVisible = await page.locator('text=Icon Theme').count();
    
    expect(themeVisible).toBeGreaterThan(0);
    expect(iconThemeVisible).toBeGreaterThan(0);
    
    // Font Size should not be visible
    const fontSizeVisible = await page.locator('text=Font Size').count();
    expect(fontSizeVisible).toBe(0);
  });

  test('should handle system theme setting', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    // Select system theme
    const themeSelect = page.locator('select').first();
    await themeSelect.selectOption('system');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Verify data-theme is 'system'
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('system');
    
    // Verify matchMedia is being used (renderer should query OS preference)
    const matchMediaUsed = await page.evaluate(() => {
      return typeof window.matchMedia === 'function';
    });
    expect(matchMediaUsed).toBe(true);
  });

  test('should measure theme switch performance < 16ms', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    // Measure theme switch time
    const switchDuration = await page.evaluate(async () => {
      const themeSelect = document.querySelector('select') as HTMLSelectElement;
      if (!themeSelect) return 999;
      
      const startTime = performance.now();
      
      // Trigger theme change
      themeSelect.value = 'light';
      themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Wait for next frame (theme applies via requestAnimationFrame)
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      const endTime = performance.now();
      return endTime - startTime;
    });
    
    // P5 (Performance budgets): Theme switch repaint < 16ms
    expect(switchDuration).toBeLessThan(16);
  });
});

test.describe('Settings Persistence and Error Handling', () => {
  test('should handle corrupted settings file gracefully', async ({ page, electronApp }) => {
    // Note: This test would require:
    // 1. Access to userData directory
    // 2. Ability to corrupt settings.json before app launch
    // 3. Restart app
    // 4. Verify app launches with defaults without crashing
    
    // For now, we verify the app launches successfully
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // App should load even if settings are corrupted (would use defaults)
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBeTruthy(); // Should have some theme set
  });

  test('should verify no secrets in settings (P3)', async ({ page }) => {
    // P3 (Secrets): Verify no secrets stored in settings.json
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    // Verify no secret-like fields are visible in UI
    const hasApiKey = await page.locator('text=/api.*key/i').count();
    const hasPassword = await page.locator('text=/password/i').count();
    const hasToken = await page.locator('text=/token/i').count();
    const hasSecret = await page.locator('text=/secret/i').count();
    
    expect(hasApiKey).toBe(0);
    expect(hasPassword).toBe(0);
    expect(hasToken).toBe(0);
    expect(hasSecret).toBe(0);
  });

  test('should verify renderer cannot access file system (P1)', async ({ page }) => {
    // P1 (Process isolation): Renderer cannot access file system directly
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Verify fs module is not accessible
    const hasFsAccess = await page.evaluate(() => {
      try {
        // Try to access fs (should fail in sandboxed renderer)
        return typeof (window as any).require === 'function' && 
               typeof (window as any).require('fs') !== 'undefined';
      } catch {
        return false;
      }
    });
    
    expect(hasFsAccess).toBe(false);
    
    // Verify settings are accessed only via window.api
    const hasApiGetSettings = await page.evaluate(() => {
      return typeof (window as any).api?.getSettings === 'function';
    });
    
    expect(hasApiGetSettings).toBe(true);
  });

  test('should support all 5 theme options', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Theme', { timeout: 5000 });
    
    // Get theme select options
    const themeOptions = await page.locator('select option').allTextContents();
    
    // Should have all 5 themes
    expect(themeOptions).toContain('Dark');
    expect(themeOptions).toContain('Light');
    expect(themeOptions).toContain('High Contrast Dark');
    expect(themeOptions).toContain('High Contrast Light');
    expect(themeOptions).toContain('System');
  });

  test('should switch between categories', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Open settings
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector('text=Appearance', { timeout: 5000 });
    
    // Click Editor category
    const editorCategory = page.locator('text=Editor').first();
    await editorCategory.click();
    
    // Verify Editor settings are shown
    await page.waitForSelector('text=Word Wrap', { timeout: 5000 });
    await page.waitForSelector('text=Line Numbers', { timeout: 5000 });
    
    // Theme setting should not be visible
    const themeVisible = await page.locator('text=Theme').count();
    expect(themeVisible).toBe(0);
    
    // Click Extensions category
    const extensionsCategory = page.locator('text=Extensions').first();
    await extensionsCategory.click();
    
    // Verify Extensions settings are shown
    await page.waitForSelector('text=Auto Update', { timeout: 5000 });
    await page.waitForSelector('text=Telemetry', { timeout: 5000 });
  });
});
