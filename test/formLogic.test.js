import { describe, it, expect, vi } from 'vitest';
import { formLogicFn } from '../src/components/formLogic.js';

describe('formLogic toString fix', () => {
  it('includes parseSurgeConfigInput definition in toString output', () => {
    const fnString = formLogicFn.toString();

    // Verify the function references parseSurgeConfigInput
    expect(fnString).toContain('parseSurgeConfigInput');

    // Verify the arrow function definitions ARE included
    expect(fnString).toMatch(/(?:const|var|let)\s+parseSurgeConfigInput\s*=/);
    expect(fnString).toMatch(/(?:const|var|let)\s+parseSurgeValue\s*=/);
    expect(fnString).toMatch(/(?:const|var|let)\s+convertSurgeIniToJson\s*=/);
  });

  it('does not contain __name calls that break in browser runtime', () => {
    const fnString = formLogicFn.toString();
    // Ensure no function declarations that esbuild would inject __name() for
    expect(fnString).not.toMatch(/^\s*function\s+parseSurgeValue\b/m);
    expect(fnString).not.toMatch(/^\s*function\s+convertSurgeIniToJson\b/m);
    expect(fnString).not.toMatch(/^\s*function\s+parseSurgeConfigInput\b/m);
  });

  it('formData() returns a valid Alpine data object', () => {
    // Simulate browser global environment using Function constructor
    const fakeWindow = { APP_TRANSLATIONS: {}, PREDEFINED_RULE_SETS: {} };
    const fn = new Function('window', '(' + formLogicFn.toString() + ')(); return window;');
    const result = fn(fakeWindow);
    const data = result.formData();
    expect(typeof data.submitForm).toBe('function');
    expect(typeof data.openAdvanced).toBe('function');
    expect(typeof data.confirmAdvanced).toBe('function');
    expect(typeof data.cancelAdvanced).toBe('function');
    expect(data.showAdvanced).toBe(false);
  });
});

function createBrowserForm() {
  const stored = new Map([['inputTextarea', 'OLD_SECRET'], ['configEditor', 'OLD_CONFIG_SECRET']]);
  const storage = {
    getItem: key => stored.get(key) ?? null,
    setItem: vi.fn((key, value) => stored.set(key, value)),
    removeItem: key => stored.delete(key)
  };
  const fetch = vi.fn(async () => new Response('Short link deleted'));
  const confirm = vi.fn(() => true);
  const fakeWindow = {
    APP_TRANSLATIONS: { deleteShortLinkConfirm: 'Confirm?', deleteShortLinkSuccess: 'Deleted', deleteShortLinkFailed: 'Failed', customRulesInvalid: 'Invalid rules', configSaveFailed: 'Save failed', rotateShortLinkConfirm: 'Replace?', rotateShortLinkSuccess: 'Replaced', rotateShortLinkFailed: 'Replacement failed' },
    PREDEFINED_RULE_SETS: {},
    APP_SHORT_LINK_ORIGINS: ['https://custom.example'],
    dispatchEvent: vi.fn(),
    history: { replaceState: vi.fn() },
    location: { origin: 'https://converter.example', href: 'https://converter.example/', search: '' }
  };
  const factory = new Function('window', 'localStorage', 'fetch', 'confirm', '(' + formLogicFn.toString() + ')(); return window.formData();');
  const data = factory(fakeWindow, storage, fetch, confirm);
  const watchers = new Map();
  data.$watch = (key, callback) => watchers.set(key, callback);
  data.$refs = { advancedDialog: { showModal: vi.fn(), close: vi.fn() } };
  return { data, stored, storage, fetch, confirm, watchers, fakeWindow };
}

describe('Private browser state and deletion', () => {
  it('removes old persisted secrets and does not save new subscription input', () => {
    const { data, stored, storage, watchers } = createBrowserForm();
    data.init();
    expect(stored.has('inputTextarea')).toBe(false);
    expect(stored.has('configEditor')).toBe(false);
    expect(data.input).toBe('');
    expect(data.configEditor).toBe('');
    watchers.get('input')('trojan://private@node.example:443');
    clearTimeout(data.parseDebounceTimer);
    watchers.get('configEditor')('PRIVATE_CONFIG');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('deletes a link using POST and clears all matching displayed client links', async () => {
    const { data, fetch } = createBrowserForm();
    const code = 'A'.repeat(32);
    data.input = `https://converter.example/c/${code}`;
    data.shortLinkState = 'valid';
    data.shortenedLinks = { singbox: `https://converter.example/b/${code}` };
    data.generatedLinks = { singbox: 'PRIVATE_SOURCE' };
    await data.deleteShortLink();
    expect(fetch).toHaveBeenCalledWith('/short-links/delete', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: `https://converter.example/c/${code}` }) }));
    expect(data.shortenedLinks).toBeNull();
    expect(data.generatedLinks).toBeNull();
    expect(data.actionStatus).toBe('Deleted');
    expect(data.input).toBe('');
    expect(data.deleting).toBe(false);
  });

  it('does not delete on cancellation or send foreign URLs to the server', async () => {
    const { data, fetch, confirm } = createBrowserForm();
    data.input = 'https://converter.example/c/code';
    data.shortLinkState = 'valid';
    confirm.mockReturnValue(false);
    await data.deleteShortLink();
    expect(fetch).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    data.input = 'https://other.example/c/code';
    await data.deleteShortLink();
    expect(fetch).not.toHaveBeenCalled();
    expect(data.isLocalShortLink).toBe(false);
  });
});

describe('Advanced options transactions', () => {
  it('restores every edited setting on cancel without storing configuration', () => {
    const { data, fetch, storage, fakeWindow } = createBrowserForm();
    data.selectedRules = ['Private'];
    data.customRules = [{ name: 'Saved', domain_suffix: 'example.com' }];
    data.currentConfigId = 'singbox_existing';
    data.openAdvanced();
    data.selectedRules.push('Google');
    data.groupByCountry = true;
    data.configEditor = '{"log":{"level":"debug"}}';
    data.currentConfigId = '';
    data.customRules[0].name = 'Unsaved';
    data.cancelAdvanced();
    expect(data.showAdvanced).toBe(false);
    expect(data.selectedRules).toEqual(['Private']);
    expect(data.customRules[0].name).toBe('Saved');
    expect(data.groupByCountry).toBe(false);
    expect(data.configEditor).toBe('');
    expect(data.currentConfigId).toBe('singbox_existing');
    expect(data.$refs.advancedDialog.close).toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('commits confirmed options and only then saves a changed base configuration', async () => {
    const { data, fetch, fakeWindow } = createBrowserForm();
    const id = `singbox_${'A'.repeat(32)}`;
    fetch.mockResolvedValue(new Response(id));
    data.openAdvanced();
    data.groupByCountry = true;
    data.configEditor = '{"log":{"level":"debug"}}';
    expect(fetch).not.toHaveBeenCalled();
    await data.confirmAdvanced();
    expect(fetch).toHaveBeenCalledWith('/config', expect.objectContaining({ method: 'POST' }));
    expect(data.showAdvanced).toBe(false);
    expect(data.groupByCountry).toBe(true);
    expect(data.currentConfigId).toBe(id);
    expect(fakeWindow.history.replaceState).toHaveBeenCalledWith({}, '', `/?configId=${id}`);
  });

  it('keeps the modal open on validation or save errors and lets cancel restore the original', async () => {
    const { data, fetch } = createBrowserForm();
    data.openAdvanced();
    data.configEditor = 'INVALID JSON';
    await data.confirmAdvanced();
    expect(data.showAdvanced).toBe(true);
    expect(data.advancedTab).toBe('baseConfig');
    expect(fetch).not.toHaveBeenCalled();
    data.configEditor = '{}';
    fetch.mockResolvedValue(new Response('failure', { status: 503 }));
    await data.confirmAdvanced();
    expect(data.showAdvanced).toBe(true);
    expect(data.advancedError).toBe('Save failed');
    data.cancelAdvanced();
    expect(data.configEditor).toBe('');
  });
});

describe('Short-link input modes', () => {
  it('recognizes current and configured domains and rejects lookalike domains', () => {
    const { data } = createBrowserForm();
    data.input = 'https://custom.example/b/code';
    expect(data.isLocalShortLink).toBe(true);
    data.input = 'https://custom.example.attacker.example/b/code';
    expect(data.isLocalShortLink).toBe(false);
    data.input = 'https://converter.example/clash?config=test';
    expect(data.isLocalShortLink).toBe(false);
  });

  it('ignores an outdated validation response after the user changes input', async () => {
    const { data, fetch } = createBrowserForm();
    let finish;
    fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    data.input = 'https://converter.example/b/old';
    const checking = data.validateInputShortLink();
    data.input = 'trojan://test@node.example:443';
    data.handleInputChange(data.input);
    clearTimeout(data.parseDebounceTimer);
    finish(new Response('{"valid":true}'));
    await checking;
    expect(data.shortLinkState).toBe('idle');
    expect(data.isLocalShortLink).toBe(false);
  });

  it('publishes only opaque new URLs after replacement and never replaces an invalid link', async () => {
    const { data, fetch } = createBrowserForm();
    const code = 'B'.repeat(32);
    data.input = 'https://custom.example/c/old';
    data.shortLinkState = 'invalid';
    await data.rotateShortLink();
    expect(fetch).not.toHaveBeenCalled();
    data.shortLinkState = 'valid';
    fetch.mockResolvedValue(Response.json({ code }));
    await data.rotateShortLink();
    expect(fetch).toHaveBeenCalledWith('/short-links/rotate', expect.objectContaining({ method: 'POST' }));
    expect(data.input).toBe(`https://converter.example/c/${code}`);
    expect(data.shortenedLinks.singbox).toBe(`https://converter.example/b/${code}`);
    expect(data.generatedLinks).toBeNull();
    expect(data.actionStatus).toBe('Replaced');
  });
});
