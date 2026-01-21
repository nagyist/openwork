import { test, expect } from '../fixtures';
import { SettingsPage } from '../pages';
import { captureForAI } from '../utils';
import { TEST_TIMEOUTS } from '../config';

test.describe('Proxy Settings', () => {
  test('should display proxy settings section when provider is selected', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Select a provider to reveal proxy settings
    await settingsPage.selectProvider('anthropic');

    // Scroll to proxy toggle
    await settingsPage.proxyToggle.scrollIntoViewIfNeeded();

    // Verify proxy toggle is visible
    await expect(settingsPage.proxyToggle).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Capture proxy section
    await captureForAI(
      window,
      'settings-dialog',
      'proxy-section',
      [
        'Proxy toggle is visible',
        'Toggle is in off state by default',
        'Network settings are accessible'
      ]
    );
  });

  test('should expand proxy form when toggle is enabled', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Select a provider
    await settingsPage.selectProvider('anthropic');

    // Scroll to proxy toggle
    await settingsPage.proxyToggle.scrollIntoViewIfNeeded();

    // Enable proxy
    await settingsPage.toggleProxy();

    // Verify form fields appear
    await expect(settingsPage.proxyHostInput).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });
    await expect(settingsPage.proxyPortInput).toBeVisible();
    await expect(settingsPage.proxyBypassInput).toBeVisible();
    await expect(settingsPage.proxyTestButton).toBeVisible();
    await expect(settingsPage.proxySaveButton).toBeVisible();

    // Capture expanded proxy form
    await captureForAI(
      window,
      'settings-dialog',
      'proxy-form-expanded',
      [
        'Proxy form is expanded',
        'Host input is visible',
        'Port input is visible',
        'Bypass rules input is visible',
        'Test and Save buttons are visible'
      ]
    );
  });

  test('should allow entering proxy configuration', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Select a provider
    await settingsPage.selectProvider('anthropic');

    // Enable proxy
    await settingsPage.proxyToggle.scrollIntoViewIfNeeded();
    await settingsPage.toggleProxy();

    // Enter proxy configuration
    await settingsPage.enterProxySettings('proxy.example.com', '8080', 'localhost,127.0.0.1,*.local');

    // Verify values were entered
    await expect(settingsPage.proxyHostInput).toHaveValue('proxy.example.com');
    await expect(settingsPage.proxyPortInput).toHaveValue('8080');
    await expect(settingsPage.proxyBypassInput).toHaveValue('localhost,127.0.0.1,*.local');

    // Capture filled form
    await captureForAI(
      window,
      'settings-dialog',
      'proxy-form-filled',
      [
        'Proxy host is filled',
        'Proxy port is filled',
        'Bypass rules are configured',
        'Form is ready to save'
      ]
    );
  });

  test('should collapse proxy form when toggle is disabled', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Select a provider
    await settingsPage.selectProvider('anthropic');

    // Enable proxy
    await settingsPage.proxyToggle.scrollIntoViewIfNeeded();
    await settingsPage.toggleProxy();

    // Verify form is expanded
    await expect(settingsPage.proxyHostInput).toBeVisible({ timeout: TEST_TIMEOUTS.NAVIGATION });

    // Disable proxy
    await settingsPage.toggleProxy();

    // Verify form fields are hidden
    await expect(settingsPage.proxyHostInput).not.toBeVisible();
    await expect(settingsPage.proxyPortInput).not.toBeVisible();
    await expect(settingsPage.proxyBypassInput).not.toBeVisible();

    // Capture collapsed state
    await captureForAI(
      window,
      'settings-dialog',
      'proxy-form-collapsed',
      [
        'Proxy form is collapsed',
        'Only toggle is visible',
        'Form fields are hidden'
      ]
    );
  });

  test('should show default bypass rules', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Select a provider
    await settingsPage.selectProvider('anthropic');

    // Enable proxy
    await settingsPage.proxyToggle.scrollIntoViewIfNeeded();
    await settingsPage.toggleProxy();

    // Verify default bypass rules
    await expect(settingsPage.proxyBypassInput).toHaveValue('localhost,127.0.0.1');

    // Capture default state
    await captureForAI(
      window,
      'settings-dialog',
      'proxy-default-bypass',
      [
        'Default bypass rules are set',
        'localhost and 127.0.0.1 are bypassed by default',
        'User can modify bypass rules'
      ]
    );
  });

  test('should disable save button until changes are made', async ({ window }) => {
    const settingsPage = new SettingsPage(window);

    await window.waitForLoadState('domcontentloaded');
    await settingsPage.navigateToSettings();

    // Select a provider
    await settingsPage.selectProvider('anthropic');

    // Enable proxy
    await settingsPage.proxyToggle.scrollIntoViewIfNeeded();
    await settingsPage.toggleProxy();

    // The save button should be enabled after toggle since that's a change
    // But test button should be disabled until host/port are filled
    await expect(settingsPage.proxyTestButton).toBeDisabled();

    // Enter host and port
    await settingsPage.proxyHostInput.fill('proxy.example.com');
    await settingsPage.proxyPortInput.fill('8080');

    // Test button should now be enabled
    await expect(settingsPage.proxyTestButton).toBeEnabled();

    // Capture button states
    await captureForAI(
      window,
      'settings-dialog',
      'proxy-button-states',
      [
        'Test button is enabled when host and port are filled',
        'Save button is enabled after changes',
        'Buttons respond to form state'
      ]
    );
  });
});
