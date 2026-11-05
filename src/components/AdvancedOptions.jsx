/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { UNIFIED_RULES } from '../config/index.js';
import { CustomRules } from './CustomRules.jsx';
import { ValidatedTextarea } from './ValidatedTextarea.jsx';

export const AdvancedOptions = ({ t }) => (
    <dialog id="advanced-options-dialog" x-ref="advancedDialog" class="advanced-dialog m-auto overflow-hidden rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-white" style="width: min(52rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem)" aria-labelledby="advanced-options-title" aria-describedby="advanced-options-help" {...{'x-on:cancel.prevent': '', 'x-on:keydown.escape.stop.prevent': ''}}>
      <div class="flex flex-col" style="max-height: calc(100dvh - 2rem)">
        <header class="shrink-0 px-6 pb-3 pt-5">
          <h2 id="advanced-options-title" class="text-xl font-semibold">{t('advancedOptions')}</h2>
          <p id="advanced-options-help" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('advancedOptionsHelp')}</p>
        </header>
        <div role="tablist" aria-label={t('advancedOptions')} class="flex shrink-0 overflow-x-auto border-b border-gray-200 px-2 dark:border-gray-700">
          <button id="advanced-tab-rules" type="button" role="tab" aria-controls="advanced-panel-rules" x-bind:aria-selected="advancedTab === 'rules'" x-bind:tabindex="advancedTab === 'rules' ? 0 : -1" x-on:click="advancedTab = 'rules'" x-on:keydown="navigateAdvancedTabs($event)" class="shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors" x-bind:class="advancedTab === 'rules' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'">{t('ruleSelection')}</button>
          <button id="advanced-tab-customRules" type="button" role="tab" aria-controls="advanced-panel-customRules" x-bind:aria-selected="advancedTab === 'customRules'" x-bind:tabindex="advancedTab === 'customRules' ? 0 : -1" x-on:click="advancedTab = 'customRules'" x-on:keydown="navigateAdvancedTabs($event)" class="shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors" x-bind:class="advancedTab === 'customRules' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'">{t('customRulesSection')}</button>
          <button id="advanced-tab-general" type="button" role="tab" aria-controls="advanced-panel-general" x-bind:aria-selected="advancedTab === 'general'" x-bind:tabindex="advancedTab === 'general' ? 0 : -1" x-on:click="advancedTab = 'general'" x-on:keydown="navigateAdvancedTabs($event)" class="shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors" x-bind:class="advancedTab === 'general' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'">{t('generalSettings')}</button>
          <button id="advanced-tab-baseConfig" type="button" role="tab" aria-controls="advanced-panel-baseConfig" x-bind:aria-selected="advancedTab === 'baseConfig'" x-bind:tabindex="advancedTab === 'baseConfig' ? 0 : -1" x-on:click="advancedTab = 'baseConfig'" x-on:keydown="navigateAdvancedTabs($event)" class="shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors" x-bind:class="advancedTab === 'baseConfig' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'">{t('baseConfigSettings')}</button>
          <button id="advanced-tab-ua" type="button" role="tab" aria-controls="advanced-panel-ua" x-bind:aria-selected="advancedTab === 'ua'" x-bind:tabindex="advancedTab === 'ua' ? 0 : -1" x-on:click="advancedTab = 'ua'" x-on:keydown="navigateAdvancedTabs($event)" class="shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors" x-bind:class="advancedTab === 'ua' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'">{t('UASettings')}</button>
          <button id="advanced-tab-subconverter" type="button" role="tab" aria-controls="advanced-panel-subconverter" x-bind:aria-selected="advancedTab === 'subconverter'" x-bind:tabindex="advancedTab === 'subconverter' ? 0 : -1" x-on:click="advancedTab = 'subconverter'" x-on:keydown="navigateAdvancedTabs($event)" class="shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors" x-bind:class="advancedTab === 'subconverter' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'">{t('subconverterConfigTitle')}</button>
        </div>
        <div class="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <section id="advanced-panel-rules" role="tabpanel" aria-labelledby="advanced-tab-rules" x-bind:hidden="advancedTab !== 'rules'">
    {/* Rule Selection */ }
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <i class="fas fa-filter text-gray-400"></i>
          {t('ruleSelection')}
        </h3>
        <select x-model="selectedPredefinedRule" x-on:change="applyPredefinedRule()" class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
        <option value="custom">{t('custom')}</option>
        <option value="minimal">{t('minimal')}</option>
        <option value="balanced">{t('balanced')}</option>
        <option value="comprehensive">{t('comprehensive')}</option>
      </select>
          </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {UNIFIED_RULES.map((rule) => (
      <label class="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group">
        <input
          type="checkbox"
          value={rule.name}
          x-model="selectedRules"
                    x-on:change="selectedPredefinedRule = 'custom'"
        class="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                  />
        <span class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
          {t(`outboundNames.${rule.name}`)}
        </span>
      </label>
    ))}
  </div>

          </div>


          </section>
          <section id="advanced-panel-customRules" role="tabpanel" aria-labelledby="advanced-tab-customRules" x-bind:hidden="advancedTab !== 'customRules'">
  {/* Custom Rules Component */ }
  <CustomRules t={t} />


          </section>
          <section id="advanced-panel-general" role="tabpanel" aria-labelledby="advanced-tab-general" x-bind:hidden="advancedTab !== 'general'">
    {/* General Options */ }
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <i class="fas fa-cog text-gray-400"></i>
              {t('generalSettings')}
            </h3>

            <div class="space-y-4">
              <label class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                <span class="font-medium text-gray-700 dark:text-gray-300">{t('groupByCountry')}</span>
                <div class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" x-model="groupByCountry" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </div>
              </label>

              <label class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                <span class="font-medium text-gray-700 dark:text-gray-300">{t('includeAutoSelect')}</span>
                <div class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" x-model="includeAutoSelect" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </div>
              </label>

              <label class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                <span class="font-medium text-gray-700 dark:text-gray-300">{t('enableClashUI')}</span>
                <div class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" x-model="enableClashUI" class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </div>
              </label>

              <div
                x-show="enableClashUI"
                {...{
                  'x-transition:enter': 'transition ease-out duration-200',
                  'x-transition:enter-start': 'opacity-0 transform -translate-y-2',
                  'x-transition:enter-end': 'opacity-100 transform translate-y-0',
                  'x-transition:leave': 'transition ease-in duration-150',
                  'x-transition:leave-start': 'opacity-100 transform translate-y-0',
                  'x-transition:leave-end': 'opacity-0 transform -translate-y-2'
                }}
                class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2"
              >
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('externalController')}</label>
                  <input type="text" x-model="externalController" class="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder={t('externalControllerPlaceholder')} />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('externalUiDownloadUrl')}</label>
                  <input type="text" x-model="externalUiDownloadUrl" class="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder={t('externalUiDownloadUrlPlaceholder')} />
                </div>
              </div>
          </div>
          </div>


          </section>
          <section id="advanced-panel-baseConfig" role="tabpanel" aria-labelledby="advanced-tab-baseConfig" x-bind:hidden="advancedTab !== 'baseConfig'">
  {/* Base Config */ }
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <i class="fas fa-file-code text-gray-400"></i>
                {t('baseConfigSettings')}
              </h3>
              <select x-model="configType" class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="singbox">SingBox (JSON)</option>
                <option value="clash">Clash (YAML)</option>
                <option value="surge">Surge (JSON/INI)</option>
              </select>
          </div>

            <ValidatedTextarea
              id="configEditor"
              name="configEditor"
              model="configEditor"
              rows={5}
              placeholder="Paste your custom config here..."
              variant="mono"
              containerClass="mt-0 group"
              labelWrapperClass="flex items-center justify-end mb-2"
              labelActionsWrapperClass="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              pasteLabel={t('paste')}
              clearLabel={t('clear')}
              validation={{
                button: {
                  key: 'validate-config',
                  label: t('validateConfig'),
                  className:
                    'px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2',
                  attrs: {
                    'x-on:click': 'validateBaseConfig()'
                  }
                },
                success: {
                  show: "configValidationState === 'success'",
                  textExpr: 'configValidationMessage'
                },
                error: {
                  show: "configValidationState === 'error'",
                  textExpr: 'configValidationMessage'
                }
              }}
              inlineActionsWrapperClass="absolute bottom-4 right-4 flex gap-2"
              preserveLabelSpace={false}
            />

            <div class="flex justify-end gap-3 mt-4">

              <button type="button" x-on:click="clearBaseConfig()" class="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium text-sm" >
  { t('clearConfig') }
              </button>
          </div>
          </div >


          </section>
          <section id="advanced-panel-ua" role="tabpanel" aria-labelledby="advanced-tab-ua" x-bind:hidden="advancedTab !== 'ua'">
  {/* User Agent */ }
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <i class="fas fa-user-secret text-gray-400"></i>
              {t('UASettings')}
            </h3>
            <input
              type="text"
              x-model="customUA"
              class="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="curl/7.74.0"
            />
          </div>
          </section>
          <section id="advanced-panel-subconverter" role="tabpanel" aria-labelledby="advanced-tab-subconverter" x-bind:hidden="advancedTab !== 'subconverter'">
  {/* Subconverter External Config */}
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
      <i class="fas fa-file-export text-gray-400"></i>
      {t('subconverterConfigTitle')}
    </h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('subconverterConfigDesc')}</p>
    <div class="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <p class="font-mono text-sm text-gray-600 dark:text-gray-400 break-all" x-text="getSubconverterUrl()"></p>
    </div>
    <div class="mt-3 flex justify-end">
      <button
        type="button"
        x-on:click="copySubconverterUrl()"
        class="px-4 py-2 rounded-lg transition-colors font-medium text-sm flex items-center gap-2"
        x-bind:class="subconverterCopied ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
      >
        <i class="fas" x-bind:class="subconverterCopied ? 'fa-check' : 'fa-copy'"></i>
        <span x-text={`subconverterCopied ? '${t('copiedSubconverterUrl')}' : '${t('copySubconverterUrl')}'`}></span>
      </button>
    </div>
  </div>


          </section>
        </div>
        <footer class="shrink-0 border-t border-gray-200 p-4 dark:border-gray-700 sm:px-6">
          <p role="alert" x-show="advancedError" x-text="advancedError" class="mb-3 text-sm text-red-600 dark:text-red-400"></p>
          <div class="flex justify-end gap-3">
            <button id="advanced-cancel" type="button" x-on:click="cancelAdvanced()" x-bind:disabled="savingConfig" class="rounded-lg border border-gray-300 px-5 py-2.5 font-medium hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700">{t('cancelOptions')}</button>
            <button id="advanced-confirm" type="button" x-on:click="confirmAdvanced()" x-bind:disabled="savingConfig" class="rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50" x-text="savingConfig ? window.APP_TRANSLATIONS.processing : window.APP_TRANSLATIONS.confirmOptions">{t('confirmOptions')}</button>
          </div>
        </footer>
      </div>
    </dialog>
);
