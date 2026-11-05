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
    expect(typeof data.toggleAccordion).toBe('function');
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
    APP_TRANSLATIONS: { deleteShortLinkConfirm: 'Confirm?', deleteShortLinkSuccess: 'Deleted', deleteShortLinkFailed: 'Failed' },
    PREDEFINED_RULE_SETS: {},
    location: { origin: 'https://converter.example', search: '' }
  };
  const factory = new Function('window', 'localStorage', 'fetch', 'confirm', '(' + formLogicFn.toString() + ')(); return window.formData();');
  const data = factory(fakeWindow, storage, fetch, confirm);
  const watchers = new Map();
  data.$watch = (key, callback) => watchers.set(key, callback);
  return { data, stored, storage, fetch, confirm, watchers };
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
    data.deleteUrl = `https://converter.example/c/${code}`;
    data.shortenedLinks = { singbox: `https://converter.example/b/${code}` };
    data.generatedLinks = { singbox: 'PRIVATE_SOURCE' };
    await data.deleteShortLink();
    expect(fetch).toHaveBeenCalledWith('/short-links/delete', expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: `https://converter.example/c/${code}` }) }));
    expect(data.shortenedLinks).toBeNull();
    expect(data.generatedLinks).toBeNull();
    expect(data.deleteStatus).toBe('Deleted');
    expect(data.deleting).toBe(false);
  });

  it('does not delete on cancellation or send foreign URLs to the server', async () => {
    const { data, fetch, confirm } = createBrowserForm();
    data.deleteUrl = 'https://converter.example/c/code';
    confirm.mockReturnValue(false);
    await data.deleteShortLink();
    expect(fetch).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    data.deleteUrl = 'https://other.example/c/code';
    await data.deleteShortLink();
    expect(fetch).not.toHaveBeenCalled();
    expect(data.deleteStatus).toBe('Failed');
  });
});
