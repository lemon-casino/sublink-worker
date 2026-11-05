export const formLogicFn = (t) => {
    window.formData = function () {
        // Inline parseSurgeConfigInput to make it available in toString()
        const parseSurgeValue = (rawValue = '') => {
            const trimmed = rawValue.trim();
            if (trimmed === '') return '';
            const unquoted = trimmed.replace(/^"(.*)"$/, '$1');
            const lower = unquoted.toLowerCase();
            if (lower === 'true') return true;
            if (lower === 'false') return false;
            if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted);
            return unquoted;
        };

        const convertSurgeIniToJson = (content) => {
            const lines = content.split(/\r?\n/);
            const config = {};
            let currentSection = null;
            const ensureObject = (key) => {
                if (!config[key]) config[key] = {};
                return config[key];
            };
            const ensureArray = (key) => {
                if (!config[key]) config[key] = [];
                return config[key];
            };
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith(';') || line.startsWith('#')) continue;
                const sectionMatch = line.match(/^\[(.+)]$/);
                if (sectionMatch) {
                    currentSection = sectionMatch[1].trim();
                    continue;
                }
                if (!currentSection) continue;
                const sectionName = currentSection.toLowerCase();
                if (sectionName === 'general' || sectionName === 'replica') {
                    const equalsIndex = line.indexOf('=');
                    if (equalsIndex === -1) continue;
                    const key = line.slice(0, equalsIndex).trim();
                    const value = line.slice(equalsIndex + 1).trim();
                    if (!key) continue;
                    const target = ensureObject(sectionName);
                    target[key] = parseSurgeValue(value);
                } else if (sectionName === 'proxy') {
                    ensureArray('proxies').push(line);
                } else if (sectionName === 'proxy group') {
                    ensureArray('proxy-groups').push(line);
                } else if (sectionName === 'rule') {
                    ensureArray('rules').push(line);
                } else {
                    ensureArray(sectionName).push(line);
                }
            }
            if (!config.general && !config.replica && !config.proxies && !config['proxy-groups']) {
                throw new Error('Unable to parse Surge INI content');
            }
            return config;
        };

        const parseSurgeConfigInput = (content) => {
            const trimmed = content.trim();
            if (!trimmed) throw new Error('Config content is empty');
            try {
                return { configObject: JSON.parse(trimmed), convertedFromIni: false };
            } catch {
                const converted = convertSurgeIniToJson(content);
                return { configObject: converted, convertedFromIni: true };
            }
        };

        const advancedKeys = ['selectedRules', 'selectedPredefinedRule', 'groupByCountry', 'includeAutoSelect', 'enableClashUI', 'externalController', 'externalUiDownloadUrl', 'configType', 'configEditor', 'currentConfigId', 'customUA', 'customRules'];
        const copy = value => JSON.parse(JSON.stringify(value));

        return {
            input: '',
            view: 'input',
            showAdvanced: false,
            advancedTab: 'rules',
            advancedSnapshot: null,
            advancedError: '',
            customRules: [],
            selectedRules: [],
            selectedPredefinedRule: 'balanced',
            subconverterCopied: false,
            groupByCountry: false,
            includeAutoSelect: true,
            enableClashUI: false,
            externalController: '',
            externalUiDownloadUrl: '',
            configType: 'singbox',
            configEditor: '',
            savingConfig: false,
            currentConfigId: '',
            configContentRequiredText: '',
            configValidationState: '',
            configValidationMessage: '',
            customUA: '',
            loading: false,
            generatedLinks: null,
            shortenedLinks: null,
            copied: null,
            shortening: false,
            deleting: false,
            rotating: false,
            actionStatus: '',
            shortLinkState: 'idle',
            inputVersion: 0,
            lastActionInput: null,
            parsingUrl: false,
            parseDebounceTimer: null,
            // These will be populated from window.APP_TRANSLATIONS
            processingText: '',
            convertText: '',
            shortenLinksText: '',
            shorteningText: '',
            showFullLinksText: '',

            init() {
                // Load translations
                if (window.APP_TRANSLATIONS) {
                    this.processingText = window.APP_TRANSLATIONS.processing;
                    this.convertText = window.APP_TRANSLATIONS.convert;
                    this.shortenLinksText = window.APP_TRANSLATIONS.shortenLinks;
                    this.shorteningText = window.APP_TRANSLATIONS.shortening;
                    this.showFullLinksText = window.APP_TRANSLATIONS.showFullLinks;
                    this.configContentRequiredText = window.APP_TRANSLATIONS.configContentRequired;
                }

                // Remove secrets persisted by earlier versions before initializing the form.
                for (const key of ['inputTextarea', 'configEditor', 'customShortCode', 'externalController', 'externalUiDownloadUrl', 'userAgent', 'enableClashUI', 'advancedToggle', 'accordionSections']) localStorage.removeItem(key);

                // Load saved preferences
                this.groupByCountry = localStorage.getItem('groupByCountry') === 'true';
                this.includeAutoSelect = localStorage.getItem('includeAutoSelect') !== 'false';
                this.configType = localStorage.getItem('configType') || 'singbox';
                const initialUrlParams = new URLSearchParams(window.location.search);
                this.currentConfigId = initialUrlParams.get('configId') || '';

                // Initialize rules
                this.applyPredefinedRule();

                // Watchers to save state
                this.$watch('input', val => {
                    this.handleInputChange(val);
                });
                this.$watch('configEditor', val => {
                    this.resetConfigValidation();
                });
                this.$watch('configType', val => {
                    this.resetConfigValidation();
                });
            },

            get localShortLink() {
                const value = this.input.trim();
                if (!value || value.includes('\n')) return null;
                try {
                    const url = new URL(value);
                    const origins = [window.location.origin, ...(window.APP_SHORT_LINK_ORIGINS || [])];
                    return origins.includes(url.origin) && !url.username && !url.password && /^\/[bcxs](?:\/|$)/.test(url.pathname) ? url.href : null;
                } catch { return null; }
            },

            get isLocalShortLink() { return this.localShortLink !== null; },

            get hasResults() { return Boolean(this.generatedLinks || this.shortenedLinks); },

            setView(view) {
                if (view === 'results' && !this.hasResults) return;
                this.view = view;
                // Finish applying inert before moving focus into the newly visible pane.
                this.$nextTick(() => requestAnimationFrame(() => {
                    if (this.view !== view) return;
                    const target = view === 'results' ? this.$refs.resultsHeading : this.$refs.inputForm.querySelector('textarea');
                    target.focus({ preventScroll: true });
                }));
            },

            resetResults() {
                this.view = 'input';
                this.generatedLinks = null;
                this.shortenedLinks = null;
                this.copied = null;
            },

            readCustomRules() {
                const input = typeof document === 'undefined' ? null : document.querySelector('input[name="customRules"]');
                const editor = input?.closest('[x-data]');
                const state = editor && window.Alpine ? window.Alpine.$data(editor) : null;
                const rules = state?.mode === 'json' ? JSON.parse(state.jsonContent) : (input?.value ? JSON.parse(input.value) : this.customRules);
                if (!Array.isArray(rules)) throw new Error('Custom rules must be an array');
                return copy(rules);
            },

            restoreCustomRules(rules, mode) {
                window.dispatchEvent(new CustomEvent('restore-custom-rules', { detail: { rules: copy(rules), mode } }));
            },

            openAdvanced() {
                if (this.showAdvanced || this.isLocalShortLink) return;
                this.advancedSnapshot = Object.fromEntries(advancedKeys.map(key => [key, copy(this[key])]));
                const input = typeof document === 'undefined' ? null : document.querySelector('input[name="customRules"]');
                const editor = input?.closest('[x-data]');
                this.advancedSnapshot.customRulesMode = editor && window.Alpine ? window.Alpine.$data(editor).mode : 'form';
                this.advancedError = '';
                this.$refs.advancedDialog.showModal();
                this.showAdvanced = true;
            },

            closeAdvanced() {
                this.showAdvanced = false;
                this.advancedSnapshot = null;
                this.$refs.advancedDialog.close();
            },

            cancelAdvanced() {
                if (this.savingConfig || !this.advancedSnapshot) return;
                const snapshot = this.advancedSnapshot;
                for (const key of advancedKeys) this[key] = copy(snapshot[key]);
                this.restoreCustomRules(this.customRules, snapshot.customRulesMode);
                this.resetConfigValidation();
                this.advancedError = '';
                this.closeAdvanced();
            },

            async confirmAdvanced() {
                if (this.savingConfig || !this.advancedSnapshot) return;
                this.advancedError = '';
                let rules;
                try { rules = this.readCustomRules(); } catch {
                    this.advancedTab = 'customRules';
                    this.advancedError = window.APP_TRANSLATIONS.customRulesInvalid;
                    return;
                }
                const previous = this.advancedSnapshot;
                if (this.configEditor.trim() && (this.configEditor !== previous.configEditor || this.configType !== previous.configType || !this.currentConfigId)) {
                    this.validateBaseConfig();
                    if (this.configValidationState === 'error') {
                        this.advancedTab = 'baseConfig';
                        this.advancedError = this.configValidationMessage;
                        return;
                    }
                    if (!await this.saveBaseConfig()) { this.advancedTab = 'baseConfig'; return; }
                }
                this.customRules = rules;
                // Confirmed changes invalidate results so navigation cannot reuse outdated settings.
                if (advancedKeys.some(key => JSON.stringify(this[key]) !== JSON.stringify(previous[key]))) this.resetResults();
                for (const [field, key] of [['groupByCountry', 'groupByCountry'], ['includeAutoSelect', 'includeAutoSelect'], ['configType', 'configType']]) localStorage.setItem(key, String(this[field]));
                this.updateConfigIdInUrl(this.currentConfigId || null);
                this.closeAdvanced();
            },

            navigateAdvancedTabs(event) {
                const tabs = ['rules', 'customRules', 'general', 'baseConfig', 'ua', 'subconverter'];
                const index = tabs.indexOf(this.advancedTab);
                if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                this.advancedTab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
                this.$nextTick(() => document.getElementById('advanced-tab-' + this.advancedTab).focus());
            },

            applyPredefinedRule() {
                if (this.selectedPredefinedRule === 'custom') return;

                // PREDEFINED_RULE_SETS will be injected globally
                const rules = window.PREDEFINED_RULE_SETS;
                if (rules && rules[this.selectedPredefinedRule]) {
                    this.selectedRules = rules[this.selectedPredefinedRule];
                }
            },

            getSubconverterUrl() {
                const origin = window.location.origin;
                const params = new URLSearchParams();

                // Use preset name directly if a predefined rule set is selected
                if (this.selectedPredefinedRule && this.selectedPredefinedRule !== 'custom') {
                    params.append('selectedRules', this.selectedPredefinedRule);
                } else if (this.selectedPredefinedRule === 'custom') {
                    params.append('selectedRules', JSON.stringify(this.selectedRules));
                }

                // Include customRules when available (best-effort; may make URL long)
                try {
                    const customRules = this.customRules;
                    if (Array.isArray(customRules) && customRules.length > 0) {
                        params.append('customRules', JSON.stringify(customRules));
                    }
                } catch { }

                if (!this.includeAutoSelect) {
                    params.append('include_auto_select', 'false');
                }

                if (this.groupByCountry) {
                    params.append('group_by_country', 'true');
                }

                // Include lang parameter so subconverter gets correct group names
                const appLang = window.APP_LANG || 'zh-CN';
                if (appLang !== 'zh-CN') {
                    params.append('lang', appLang);
                }

                const queryString = params.toString();
                return origin + '/subconverter' + (queryString ? '?' + queryString : '');
            },

            copySubconverterUrl() {
                const url = this.getSubconverterUrl();
                navigator.clipboard.writeText(url).then(() => {
                    this.subconverterCopied = true;
                    setTimeout(() => this.subconverterCopied = false, 2000);
                }).catch(() => {});
            },

            resetConfigValidation() {
                this.configValidationState = '';
                this.configValidationMessage = '';
            },

            async saveBaseConfig() {
                this.savingConfig = true;
                try {
                    const content = this.configType === 'surge' ? JSON.stringify(parseSurgeConfigInput(this.configEditor).configObject) : this.configEditor;
                    const response = await fetch('/config', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: this.configType, content })
                    });
                    if (!response.ok) throw new Error('Unable to save the base configuration');
                    const id = (await response.text()).trim();
                    if (!id) throw new Error('Missing configuration ID');
                    this.currentConfigId = id;
                    return true;
                } catch {
                    this.advancedError = window.APP_TRANSLATIONS.configSaveFailed;
                    return false;
                } finally { this.savingConfig = false; }
            },

            validateBaseConfig() {
                const content = (this.configEditor || '').trim();
                if (!content) {
                    this.configValidationState = 'error';
                    this.configValidationMessage = this.configContentRequiredText || window.APP_TRANSLATIONS.configContentRequired;
                    return;
                }

                try {
                    if (this.configType === 'clash') {
                        if (!window.jsyaml || !window.jsyaml.load) {
                            throw new Error(window.APP_TRANSLATIONS.parserUnavailable || 'Parser unavailable. Please refresh and try again.');
                        }
                        window.jsyaml.load(content);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validYamlConfig || 'YAML config is valid';
                    } else if (this.configType === 'surge') {
                        parseSurgeConfigInput(this.configEditor);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validJsonConfig || 'JSON config is valid';
                    } else {
                        JSON.parse(content);
                        this.configValidationState = 'success';
                        this.configValidationMessage =
                            window.APP_TRANSLATIONS.validJsonConfig || 'JSON config is valid';
                    }
                } catch (error) {
                    this.configValidationState = 'error';
                    const prefix = window.APP_TRANSLATIONS.configValidationError || 'Config validation error: ';
                    this.configValidationMessage = `${prefix}${error?.message || ''}`;
                }
            },

            clearBaseConfig() {
                if (confirm(window.APP_TRANSLATIONS.confirmClearConfig)) {
                    this.configEditor = '';
                    localStorage.removeItem('configEditor');
                    this.currentConfigId = '';
                }
            },

            clearAll() {
                if (confirm(window.APP_TRANSLATIONS.confirmClearAll)) {
                    this.input = '';
                    this.resetResults();
                    this.actionStatus = '';

                    // Also clear from localStorage
                    localStorage.removeItem('customShortCode');
                }
            },

            updateConfigIdInUrl(configId) {
                const url = new URL(window.location.href);
                if (configId) {
                    url.searchParams.set('configId', configId);
                } else {
                    url.searchParams.delete('configId');
                }
                window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
            },

            async submitForm() {
                if (this.showAdvanced || this.rotating || this.deleting) return;
                if (this.isLocalShortLink) { await this.deleteShortLink(); return; }
                this.loading = true;
                this.shortenedLinks = null; // Reset shortened links when generating new links
                try {
                    // Construct URLs
                    const origin = window.location.origin;
                    const params = new URLSearchParams();
                    params.append('config', this.input);
                    params.append('ua', this.customUA);
                    params.append('selectedRules', JSON.stringify(this.selectedRules));
                    params.append('customRules', JSON.stringify(this.customRules));

                    if (this.groupByCountry) params.append('group_by_country', 'true');
                    if (!this.includeAutoSelect) params.append('include_auto_select', 'false');
                    if (this.enableClashUI) {
                        params.append('enable_clash_ui', 'true');
                        if (this.externalController) params.append('external_controller', this.externalController);
                        if (this.externalUiDownloadUrl) params.append('external_ui_download_url', this.externalUiDownloadUrl);
                    }

                    // Add configId if present in URL
                    const urlParams = new URLSearchParams(window.location.search);
                    const configId = this.currentConfigId || urlParams.get('configId');
                    if (configId) {
                        params.append('configId', configId);
                    }

                    const queryString = params.toString();

                    this.generatedLinks = {
                        xray: origin + '/xray?' + queryString,
                        singbox: origin + '/singbox?' + queryString,
                        clash: origin + '/clash?' + queryString,
                        surge: origin + '/surge?' + queryString
                    };

                    this.setView('results');

                } catch (error) {
                    console.error('Error generating links:', error);
                    alert(window.APP_TRANSLATIONS.errorGeneratingLinks);
                } finally {
                    this.loading = false;
                }
            },

            async shortenLinks() {
                // Check if links are already shortened
                if (this.shortenedLinks) {
                    alert(window.APP_TRANSLATIONS.alreadyShortened);
                    return;
                }

                if (!this.generatedLinks) {
                    return;
                }

                this.shortening = true;
                try {
                    const origin = window.location.origin;
                    const shortened = {};

                    const response = await fetch('/shorten-v2', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: Object.values(this.generatedLinks)[0] })
                    });
                    if (!response.ok) throw new Error('Unable to create a short link');
                    const code = (await response.text()).trim();
                    const prefixes = { xray: 'x', singbox: 'b', clash: 'c', surge: 's' };
                    for (const [type, prefix] of Object.entries(prefixes)) shortened[type] = origin + '/' + prefix + '/' + code;

                    this.shortenedLinks = shortened;
                } catch (error) {
                    console.error('Error shortening links:', error);
                    alert(window.APP_TRANSLATIONS.shortenFailed);
                } finally {
                    this.shortening = false;
                }
            },

            async deleteShortLink() {
                const url = this.localShortLink;
                if (!url || this.shortLinkState !== 'valid' || this.deleting || this.rotating || !confirm(window.APP_TRANSLATIONS.deleteShortLinkConfirm)) return;
                this.deleting = true;
                this.actionStatus = '';
                try {
                    const response = await fetch('/short-links/delete', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
                    });
                    if (!response.ok) throw new Error('Unable to delete the short link');
                    this.resetResults();
                    this.lastActionInput = '';
                    this.input = '';
                    this.shortLinkState = 'idle';
                    this.actionStatus = window.APP_TRANSLATIONS.deleteShortLinkSuccess;
                } catch { this.actionStatus = window.APP_TRANSLATIONS.deleteShortLinkFailed; }
                finally { this.deleting = false; }
            },

            async rotateShortLink() {
                const url = this.localShortLink;
                if (!url || this.shortLinkState !== 'valid' || this.rotating || this.deleting || !confirm(window.APP_TRANSLATIONS.rotateShortLinkConfirm)) return;
                this.rotating = true;
                this.actionStatus = '';
                try {
                    const response = await fetch('/short-links/rotate', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
                    });
                    if (!response.ok) {
                        if ([400, 404, 410].includes(response.status)) this.shortLinkState = 'invalid';
                        throw new Error('Unable to replace the short link');
                    }
                    const { code } = await response.json();
                    if (!/^[A-Za-z0-9]{32}$/.test(code)) throw new Error('Invalid replacement code');
                    const prefixes = { xray: 'x', singbox: 'b', clash: 'c', surge: 's' };
                    this.generatedLinks = null;
                    this.shortenedLinks = Object.fromEntries(Object.entries(prefixes).map(([type, prefix]) => [type, window.location.origin + '/' + prefix + '/' + code]));
                    const prefix = new URL(url).pathname.split('/')[1];
                    const next = window.location.origin + '/' + prefix + '/' + code;
                    this.lastActionInput = next;
                    this.input = next;
                    this.shortLinkState = 'valid';
                    this.actionStatus = window.APP_TRANSLATIONS.rotateShortLinkSuccess;
                    this.setView('results');
                } catch { this.actionStatus = window.APP_TRANSLATIONS.rotateShortLinkFailed; }
                finally { this.rotating = false; }
            },

            async validateInputShortLink() {
                const url = this.localShortLink;
                const version = ++this.inputVersion;
                if (!url) { this.shortLinkState = 'idle'; return; }
                this.shortLinkState = 'checking';
                try {
                    const response = await fetch('/short-links/inspect', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
                    });
                    if (version !== this.inputVersion || url !== this.localShortLink) return;
                    this.shortLinkState = response.ok ? 'valid' : ([400, 404, 410].includes(response.status) ? 'invalid' : 'error');
                } catch { if (version === this.inputVersion) this.shortLinkState = 'error'; }
            },

            handleInputChange(val) {
                if (this.parseDebounceTimer) clearTimeout(this.parseDebounceTimer);
                this.inputVersion++;
                const preserve = this.lastActionInput !== null && val === this.lastActionInput;
                this.lastActionInput = null;
                if (!preserve) {
                    this.actionStatus = '';
                    this.resetResults();
                }
                this.shortLinkState = this.isLocalShortLink ? 'checking' : 'idle';
                if (!val?.trim()) return;
                this.parseDebounceTimer = setTimeout(() => {
                    if (this.isLocalShortLink) this.validateInputShortLink();
                    else this.tryParseSubscriptionUrl(val.trim());
                }, 300);
            },

            // Check if input looks like a subscription URL
            isSubscriptionUrl(text) {
                // Check if it's a single line URL (not multiple lines)
                if (text.includes('\n')) {
                    return false;
                }

                try {
                    const url = new URL(text);
                    // Check if it's a full subscription URL with query params
                    const fullMatch = url.pathname.match(/^\/(singbox|clash|xray|surge)$/);
                    if (fullMatch && url.search) {
                        return true;
                    }

                    return false;
                } catch {
                    return false;
                }
            },

            // Try to parse subscription URL
            async tryParseSubscriptionUrl(text) {
                if (!this.isSubscriptionUrl(text)) {
                    return;
                }

                this.parsingUrl = true;
                try {
                    let urlToParse;

                    try {
                        urlToParse = new URL(text);
                    } catch {
                        return;
                    }

                    // Now parse the full URL and populate form
                    this.populateFormFromUrl(urlToParse);

                    // Show a success message
                    const message = window.APP_TRANSLATIONS?.urlParsedSuccess || '已成功解析订阅链接配置';
                    console.log(message);

                } catch (error) {
                    console.error('Error parsing subscription URL:', error);
                } finally {
                    this.parsingUrl = false;
                }
            },

            // Populate form fields from parsed URL
            populateFormFromUrl(url) {
                const params = new URLSearchParams(url.search);

                // Extract config (the original subscription URLs)
                const config = params.get('config');
                if (config) {
                    this.input = config;
                }

                // Extract selectedRules
                const selectedRules = params.get('selectedRules');
                if (selectedRules) {
                    try {
                        const parsed = JSON.parse(selectedRules);
                        if (Array.isArray(parsed)) {
                            this.selectedRules = parsed;
                            this.selectedPredefinedRule = 'custom';
                        }
                    } catch (e) {
                        console.warn('Failed to parse selectedRules:', e);
                    }
                }

                // Extract customRules
                const customRules = params.get('customRules');
                if (customRules) {
                    try {
                        const parsed = JSON.parse(customRules);
                        if (Array.isArray(parsed)) {
                            this.customRules = copy(parsed);
                            // Keep the editor synchronized with imported settings.
                            window.dispatchEvent(new CustomEvent('restore-custom-rules', {
                                detail: { rules: parsed }
                            }));
                        }
                    } catch (e) {
                        console.warn('Failed to parse customRules:', e);
                    }
                }

                // Extract other parameters
                this.groupByCountry = params.get('group_by_country') === 'true';
                this.includeAutoSelect = params.get('include_auto_select') !== 'false';
                this.enableClashUI = params.get('enable_clash_ui') === 'true';

                const externalController = params.get('external_controller');
                if (externalController) {
                    this.externalController = externalController;
                }

                const externalUiDownloadUrl = params.get('external_ui_download_url');
                if (externalUiDownloadUrl) {
                    this.externalUiDownloadUrl = externalUiDownloadUrl;
                }

                const ua = params.get('ua');
                if (ua) {
                    this.customUA = ua;
                }

                const configId = params.get('configId');
                if (configId) {
                    this.currentConfigId = configId;
                    this.updateConfigIdInUrl(configId);
                }


            }
        }
    }
};
