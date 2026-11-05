/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { PREDEFINED_RULE_SETS } from '../config/index.js';
import { TextareaWithActions } from './TextareaWithActions.jsx';
import { AdvancedOptions } from './AdvancedOptions.jsx';
import { formLogicFn } from './formLogic.js';

const LINK_FIELDS = [
  { key: 'xray', labelKey: 'xrayLink' },
  { key: 'singbox', labelKey: 'singboxLink' },
  { key: 'clash', labelKey: 'clashLink' },
  { key: 'surge', labelKey: 'surgeLink' }
];

export const Form = (props) => {
  const { t, lang, shortLinkOrigins = [] } = props;

  const translations = {
    processing: t('processing'),
    convert: t('convert'),
    configContentRequired: t('configContentRequired'),
    configSaveFailed: t('configSaveFailed'),
    confirmClearConfig: t('confirmClearConfig'),
    confirmClearAll: t('confirmClearAll'),
    errorGeneratingLinks: t('errorGeneratingLinks'),
    shortenLinks: t('shortenLinks'),
    shortening: t('shortening'),
    alreadyShortened: t('alreadyShortened'),
    shortenFailed: t('shortenFailed'),
    showFullLinks: t('showFullLinks'),
    deleteShortLinkConfirm: t('deleteShortLinkConfirm'),
    deleteShortLinkSuccess: t('deleteShortLinkSuccess'),
    deleteShortLinkFailed: t('deleteShortLinkFailed'),
    confirmOptions: t('confirmOptions'),
    advancedOptionsHelp: t('advancedOptionsHelp'),
    advancedOptionsFailed: t('advancedOptionsFailed'),
    customRulesInvalid: t('customRulesInvalid'),
    deleteShortLink: t('deleteShortLink'),
    rotateShortLink: t('rotateShortLink'),
    configValidationError: t('configValidationError'),
    validYamlConfig: t('validYamlConfig'),
    validJsonConfig: t('validJsonConfig'),
    parserUnavailable: t('parserUnavailable'),
    rotateShortLinkConfirm: t('rotateShortLinkConfirm'),
    rotateShortLinkSuccess: t('rotateShortLinkSuccess'),
    rotateShortLinkFailed: t('rotateShortLinkFailed'),
    shortLinkDetected: t('shortLinkDetected'),
    shortLinkInvalid: t('shortLinkInvalid'),
    shortLinkChecking: t('shortLinkChecking'),
    shortLinkCheckFailed: t('shortLinkCheckFailed')
  };

  const scriptContent = `
    window.APP_TRANSLATIONS = ${JSON.stringify(translations)};
    window.PREDEFINED_RULE_SETS = ${JSON.stringify(PREDEFINED_RULE_SETS)};
    window.APP_LANG = ${JSON.stringify(lang || 'zh-CN')};
    window.APP_SHORT_LINK_ORIGINS = ${JSON.stringify(shortLinkOrigins)};
    if (typeof __name === 'undefined') { var __name = function(fn) { return fn; }; }
    (${formLogicFn.toString()})();
  `;

  return (
    <div x-data="formData()" class="max-w-4xl mx-auto">
      <form {...{'x-on:submit.prevent': 'submitForm'}} class="space-y-8">

      {/* Input Section */}
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-md group">
        <TextareaWithActions
          id="input"
          name="input"
          label={t('shareUrls')}
          labelPrefix={
            <span class="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <i class="fas fa-link text-sm"></i>
            </span>
          }
          model="input"
          rows={5}
          placeholder={t('sourceInputPlaceholder')}
          required
          textareaAttrs={{ 'x-bind:disabled': 'deleting || rotating' }}
          labelActionsWrapperClass="flex gap-2"
          labelActions={[
            {
              key: 'paste',
              icon: 'fas fa-paste',
              label: t('paste'),
              hideLabelOnMobile: true,
              className:
                'px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1',
              title: t('paste'),
              attrs: {
                'x-on:click': "navigator.clipboard.readText().then(text => input = text).catch(() => {})"
              }
            },
            {
              key: 'clear',
              icon: 'fas fa-times',
              label: t('clear'),
              hideLabelOnMobile: true,
              className:
                'px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1',
              title: t('clear'),
              attrs: {
                'x-on:click': "input = ''",
                'x-show': 'input'
              }
            }
          ]}
        />
        <div x-cloak x-show="isLocalShortLink" class="mt-3 flex flex-wrap items-start gap-2 text-sm" role="status" aria-live="polite">
          <span x-text="shortLinkState === 'valid' ? window.APP_TRANSLATIONS.shortLinkDetected : (shortLinkState === 'invalid' ? window.APP_TRANSLATIONS.shortLinkInvalid : (shortLinkState === 'error' ? window.APP_TRANSLATIONS.shortLinkCheckFailed : window.APP_TRANSLATIONS.shortLinkChecking))" x-bind:class="shortLinkState === 'invalid' || shortLinkState === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'"></span>
          <button type="button" x-show="shortLinkState === 'invalid' || shortLinkState === 'error'" x-on:click="validateInputShortLink()" class="font-medium text-primary-600 hover:underline dark:text-primary-400">{t('retryShortLinkCheck')}</button>
        </div>
        <p role="status" aria-live="polite" x-show="actionStatus" x-text="actionStatus" class="mt-3 text-sm text-gray-700 dark:text-gray-300"></p>
      </div>

      <button id="advanced-options-trigger" type="button" x-on:click="openAdvanced()" x-bind:disabled="isLocalShortLink || loading || deleting || rotating" aria-haspopup="dialog" aria-controls="advanced-options-dialog" class="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
        <span class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"><i class="fas fa-sliders-h" aria-hidden="true"></i></span><span class="font-semibold">{t('advancedOptions')}</span></span>
        <i class="fas fa-external-link-alt text-gray-400" aria-hidden="true"></i>
      </button>

      <div class="flex flex-col gap-3 sm:flex-row">
        <button id="primary-action" type="submit" x-bind:disabled="loading || deleting || rotating || (isLocalShortLink && shortLinkState !== 'valid')" class="flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-bold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50" x-bind:class="isLocalShortLink ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'">
          <i class="fas" aria-hidden="true" x-bind:class="loading || deleting ? 'fa-spinner fa-spin' : (isLocalShortLink ? 'fa-trash-alt' : 'fa-sync-alt')"></i>
          <span x-text="loading || deleting ? processingText : (isLocalShortLink ? window.APP_TRANSLATIONS.deleteShortLink : convertText)">{t('convert')}</span>
        </button>
        <button id="rotate-short-link" type="button" x-cloak x-show="isLocalShortLink" x-on:click="rotateShortLink()" x-bind:disabled="shortLinkState !== 'valid' || deleting || rotating || loading" class="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"><i class="fas" aria-hidden="true" x-bind:class="rotating ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i><span>{t('rotateShortLink')}</span></button>
        <button type="button" x-on:click="clearAll()" x-bind:disabled="loading || deleting || rotating" class="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"><i class="fas fa-trash-alt" aria-hidden="true"></i>{t('clear')}</button>
      </div>
      </form>

      <AdvancedOptions t={t} />

  {/* Results Section */ }
  <div x-cloak x-show="generatedLinks || shortenedLinks" x-data="{ copied: null }" {...{'x-transition:enter': 'transition ease-out duration-500', 'x-transition:enter-start': 'opacity-0 transform translate-y-8', 'x-transition:enter-end': 'opacity-100 transform translate-y-0'}} class="mt-12">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8 transition-all duration-300 hover:shadow-md">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
            <i class="fas fa-link text-sm"></i>
          </span>
          {t('subscriptionLinks')}
        </h2>
      </div>

      <div class="mt-6 space-y-4">
        {LINK_FIELDS.map((field) => (
          <div class="relative group" key={field.key}>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t(field.labelKey)}
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                readonly
                x-bind:value={`shortenedLinks ? shortenedLinks?.${field.key} : generatedLinks?.${field.key}`}
                class="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:border-transparent transition-all duration-200 font-mono text-sm"
                x-bind:class="shortenedLinks ? 'text-primary-600 dark:text-primary-400 font-semibold focus:ring-primary-500' : 'text-gray-600 dark:text-gray-400 focus:ring-green-500'"
              />
              <button
                type="button"
                x-on:click={`navigator.clipboard.writeText((shortenedLinks || generatedLinks)?.${field.key}); copied = '${field.key}'; setTimeout(() => copied = null, 2000)`}
                class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                x-bind:class={`{
                  'hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400': !shortenedLinks,
                  'hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400': shortenedLinks,
                  'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400': !shortenedLinks && copied === '${field.key}',
                  'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': shortenedLinks && copied === '${field.key}'
                }`}
              >
                <i class="fas" x-bind:class={`copied === '${field.key}' ? 'fa-check' : 'fa-copy'`}></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Shortening Controls */}
      <div class="mt-6" x-show="generatedLinks">
        <div class="flex justify-center mt-4">
          <button
            type="button"
            x-on:click="shortenedLinks ? shortenedLinks = null : shortenLinks()"
            x-bind:disabled="!shortenedLinks && shortening"
            class="px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg"
            x-bind:class="shortenedLinks
              ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
              : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white shadow-primary-500/30 hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed'"
          >
            <i
              class="fas"
              x-bind:class="shortenedLinks ? 'fa-expand-alt' : (shortening ? 'fa-spinner fa-spin' : 'fa-compress-alt')"
            ></i>
            <span
              x-text="shortenedLinks ? showFullLinksText : (shortening ? shorteningText : shortenLinksText)"
            ></span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <script dangerouslySetInnerHTML={{ __html: scriptContent }} />
    </div>
  );
};
