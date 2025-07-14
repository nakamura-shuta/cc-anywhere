// CC-Anywhere Web UI - フル機能版
// 基本機能 + SDKオプション対応

// === 基本機能の変数定義 ===
let apiClient;
let currentTasks = new Map();
let selectedTaskId = null;
let statusFilter = '';
let detailRefreshInterval = null;

// クエリパラメータからAPIキーを取得はutils.jsから使用

// === SDKオプション関連の追加機能 ===

// リポジトリ一覧を読み込み
async function loadRepositories() {
    try {
        const data = await apiClient.getRepositories();
        const select = document.getElementById('repositories');
        
        // 既存のオプションをクリア
        select.innerHTML = '';
        
        // リポジトリ一覧を追加
        data.repositories.forEach((repo, index) => {
            const option = document.createElement('option');
            option.value = repo.path;
            option.text = `${repo.name} (${repo.path})`;
            
            // 最初のリポジトリをデフォルト選択
            if (index === 0) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        // 選択状態の検証
        validateRepositorySelection();
        
    } catch (error) {
        console.error('Failed to load repositories:', error);
        showError('リポジトリ一覧の読み込みに失敗しました');
    }
}

// 基本的なイベントリスナー設定
function setupEventListeners() {
    // タスク作成フォーム
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmitWithSDK);
    
    // リポジトリ選択の変更監視
    const repositorySelect = document.getElementById('repositories');
    repositorySelect.addEventListener('change', validateRepositorySelection);

    // ステータスフィルター
    document.getElementById('status-filter').addEventListener('change', (e) => {
        statusFilter = e.target.value;
        pagination.currentPage = 1; // フィルタ変更時は1ページ目にリセット
        loadTasks(1);
    });

    // モーダル閉じるボタン
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('task-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    // Worktreeオプションの表示/非表示
    document.getElementById('use-worktree').addEventListener('change', (e) => {
        const worktreeOptions = document.getElementById('worktree-options');
        worktreeOptions.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // モバイルでのタスクIDコピー機能
    if ('ontouchstart' in window) {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('task-id')) {
                const taskId = e.target.textContent;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(taskId).then(() => {
                        const originalText = e.target.textContent;
                        e.target.textContent = 'コピー済み!';
                        setTimeout(() => {
                            e.target.textContent = originalText;
                        }, 1000);
                    });
                }
            }
        });
    }
}

// APIからプリセットを取得
async function loadPresets() {
    try {
        console.log('Loading presets...', api);
        if (!api) {
            console.error('API client not initialized');
            return;
        }
        
        const data = await api.getPresets();
        console.log('Presets loaded:', data);
        
        const presetSelector = document.getElementById('preset-selector');
        if (!presetSelector) {
            console.error('Preset selector element not found');
            return;
        }
        
        // 「読み込み中...」のオプションを削除
        const loadingOption = presetSelector.querySelector('option[value="loading"]');
        if (loadingOption) {
            loadingOption.remove();
        }
        
        // 既存のオプションをクリア（カスタム設定は残す）
        while (presetSelector.options.length > 1) {
            presetSelector.remove(1);
        }
        
        // システムプリセットを追加
        if (data.presets && Array.isArray(data.presets)) {
            data.presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = `${preset.name} (システム)`;
                option.dataset.description = preset.description || '';
                option.dataset.settings = JSON.stringify(preset.settings);
                presetSelector.appendChild(option);
            });
        }
        
        // ユーザープリセットを追加
        if (data.userPresets && Array.isArray(data.userPresets)) {
            data.userPresets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.name;
                option.dataset.description = preset.description || '';
                option.dataset.settings = JSON.stringify(preset.settings);
                presetSelector.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('プリセットの読み込みに失敗しました:', error);
        // showNotificationが未定義の場合は直接エラーメッセージを表示
        if (typeof showNotification === 'function') {
            showNotification('プリセットの読み込みに失敗しました', 'error');
        } else if (typeof showError === 'function') {
            showError('プリセットの読み込みに失敗しました');
        } else {
            console.error('プリセットの読み込みに失敗しました');
        }
    }
}

// SDKオプション関連のイベントリスナー設定
function setupSDKOptionsListeners() {
    // プリセット選択
    const presetSelector = document.getElementById('preset-selector');
    presetSelector.addEventListener('change', handlePresetChange);
    
    // プリセット保存・削除ボタン
    const savePresetBtn = document.getElementById('save-preset-btn');
    const deletePresetBtn = document.getElementById('delete-preset-btn');
    
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', showSavePresetModal);
    }
    
    if (deletePresetBtn) {
        deletePresetBtn.addEventListener('click', deleteCurrentPreset);
    }
    
    // スライダーと数値入力の同期
    const maxTurnsSlider = document.getElementById('max-turns-slider');
    const maxTurnsInput = document.getElementById('max-turns');
    const maxTurnsValue = document.getElementById('max-turns-value');
    
    maxTurnsSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        maxTurnsInput.value = value;
        maxTurnsValue.textContent = value;
    });
    
    maxTurnsInput.addEventListener('input', (e) => {
        const value = e.target.value;
        maxTurnsSlider.value = value;
        maxTurnsValue.textContent = value;
    });
    
    // 権限モードトグル
    const toggleButtons = document.querySelectorAll('.toggle-group .toggle-btn');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', handlePermissionModeToggle);
    });
    
    // システムプロンプトの文字数カウント
    const systemPrompt = document.getElementById('system-prompt');
    const charCount = document.getElementById('system-prompt-count');
    
    systemPrompt.addEventListener('input', (e) => {
        const length = e.target.value.length;
        charCount.textContent = `${length} / 10,000`;
        
        if (length > 9000) {
            charCount.classList.add('warning');
        } else {
            charCount.classList.remove('warning');
        }
        
        if (length >= 10000) {
            charCount.classList.add('error');
        } else {
            charCount.classList.remove('error');
        }
    });
    
    // タブ切り替え
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', handleTabSwitch);
    });
    
    // ツールクイックアクション
    const quickActionButtons = document.querySelectorAll('.quick-action-btn');
    quickActionButtons.forEach(btn => {
        btn.addEventListener('click', handleQuickAction);
    });
    
    // MCP設定のバリデーション
    const mcpConfig = document.getElementById('mcp-config');
    const mcpValidation = document.getElementById('mcp-validation');
    
    mcpConfig.addEventListener('input', debounce((e) => {
        validateMCPConfig(e.target.value, mcpValidation);
    }, 500));
    
    // 高度な設定の開閉時のアイコン回転
    const advancedSettings = document.querySelector('.advanced-settings');
    advancedSettings.addEventListener('toggle', (e) => {
        const icon = e.target.querySelector('.collapse-icon');
        if (e.target.open) {
            icon.style.transform = 'rotate(90deg)';
        } else {
            icon.style.transform = 'rotate(0deg)';
        }
    });
}

// プリセット変更処理
function handlePresetChange(e) {
    const presetId = e.target.value;
    const description = document.getElementById('preset-description');
    const selectedOption = e.target.selectedOptions[0];
    const deleteBtn = document.getElementById('delete-preset-btn');
    
    if (!presetId) {
        description.textContent = 'カスタム設定を使用します';
        deleteBtn.style.display = 'none';
        return;
    }
    
    // 説明文の更新
    description.textContent = selectedOption.dataset.description || '';
    
    // ユーザープリセットの場合のみ削除ボタンを表示
    const isSystemPreset = selectedOption.textContent.includes('(システム)');
    deleteBtn.style.display = isSystemPreset ? 'none' : 'inline-block';
    
    // プリセット設定の適用
    try {
        const settings = JSON.parse(selectedOption.dataset.settings || '{}');
        applyPresetOptions(settings);
    } catch (error) {
        console.error('プリセット設定の適用に失敗しました:', error);
    }
}

// プリセットオプションの適用
function applyPresetOptions(settings) {
    
    // SDKオプションがある場合
    const sdkOptions = settings.sdk || {};
    
    // maxTurns
    if (sdkOptions.maxTurns !== undefined) {
        document.getElementById('max-turns').value = sdkOptions.maxTurns;
        document.getElementById('max-turns-slider').value = sdkOptions.maxTurns;
        document.getElementById('max-turns-value').textContent = sdkOptions.maxTurns;
    }
    
    // permissionMode
    if (sdkOptions.permissionMode) {
        document.querySelectorAll('.toggle-group .toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === sdkOptions.permissionMode) {
                btn.classList.add('active');
                updatePermissionDescription(btn);
            }
        });
    }
    
    // systemPrompt
    if (sdkOptions.systemPrompt) {
        document.getElementById('system-prompt').value = sdkOptions.systemPrompt;
        // 文字数カウント更新
        const charCount = document.getElementById('system-prompt-count');
        charCount.textContent = `${sdkOptions.systemPrompt.length} / 10,000`;
    }
    
    // allowedTools
    if (sdkOptions.allowedTools) {
        // まず全てのチェックボックスを解除
        document.querySelectorAll('input[name="allowedTools"]').forEach(cb => {
            cb.checked = false;
        });
        
        // プリセットで指定されたツールをチェック
        if (sdkOptions.allowedTools.includes('*')) {
            // すべて許可
            document.querySelectorAll('input[name="allowedTools"]').forEach(cb => {
                cb.checked = true;
            });
        } else {
            sdkOptions.allowedTools.forEach(tool => {
                const checkbox = document.querySelector(`input[name="allowedTools"][value="${tool}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    }
    
    // disallowedTools
    if (sdkOptions.disallowedTools) {
        document.querySelectorAll('input[name="disallowedTools"]').forEach(cb => {
            cb.checked = false;
        });
        
        sdkOptions.disallowedTools.forEach(tool => {
            const checkbox = document.querySelector(`input[name="disallowedTools"][value="${tool}"]`);
            if (checkbox) checkbox.checked = true;
        });
        
        // 禁止ツールタブに切り替え
        document.querySelector('[data-tab="disallowed"]').click();
    }
    
    // outputFormat
    if (sdkOptions.outputFormat) {
        const radio = document.querySelector(`input[name="outputFormat"][value="${sdkOptions.outputFormat}"]`);
        if (radio) radio.checked = true;
    }
    
    // verbose
    if (sdkOptions.verbose !== undefined) {
        document.getElementById('verbose').checked = sdkOptions.verbose;
    }
    
    // タイムアウト（SDK外の設定）
    if (settings.timeout !== undefined) {
        document.getElementById('timeout').value = settings.timeout / 1000; // ミリ秒を秒に変換
    }
    
    // Worktree設定
    if (settings.useWorktree !== undefined) {
        document.getElementById('use-worktree').checked = settings.useWorktree;
        document.getElementById('worktree-options').style.display = settings.useWorktree ? 'block' : 'none';
    }
}

// 権限モードトグル処理
function handlePermissionModeToggle(e) {
    const btn = e.currentTarget;
    
    // アクティブ状態の切り替え
    document.querySelectorAll('.toggle-group .toggle-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
    
    // 説明文の更新
    updatePermissionDescription(btn);
}

// 権限モードの説明文更新
function updatePermissionDescription(btn) {
    const description = document.querySelector('.permission-description');
    description.textContent = btn.dataset.description || '';
}

// タブ切り替え処理
function handleTabSwitch(e) {
    const btn = e.currentTarget;
    const tabName = btn.dataset.tab;
    
    // ボタンのアクティブ状態切り替え
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
    
    // コンテンツの表示切り替え
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tools-tab`).classList.add('active');
}

// ツールクイックアクション処理
function handleQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    const activeTab = document.querySelector('.tab-content.active');
    const checkboxes = activeTab.querySelectorAll('input[type="checkbox"]');
    
    switch (action) {
        case 'all':
            checkboxes.forEach(cb => cb.checked = true);
            break;
        case 'none':
            checkboxes.forEach(cb => cb.checked = false);
            break;
        case 'safe':
            checkboxes.forEach(cb => {
                const toolName = cb.value;
                cb.checked = ['Read', 'LS', 'Glob', 'Grep'].includes(toolName);
            });
            break;
    }
}

// MCP設定のバリデーション
function validateMCPConfig(value, validationElement) {
    if (!value.trim()) {
        validationElement.style.display = 'none';
        return;
    }
    
    try {
        const config = JSON.parse(value);
        
        // 各サーバー設定の検証
        for (const [name, serverConfig] of Object.entries(config)) {
            if (!serverConfig.command) {
                throw new Error(`Server '${name}' is missing required 'command' field`);
            }
        }
        
        validationElement.textContent = '✓ 有効なJSON形式です';
        validationElement.className = 'validation-message success';
    } catch (error) {
        validationElement.textContent = `✗ ${error.message}`;
        validationElement.className = 'validation-message error';
    }
}

// 現在の設定を収集（プリセット保存用）
function collectCurrentSettings() {
    const settings = {
        sdk: {},
        timeout: parseInt(document.getElementById('timeout').value) * 1000,
        useWorktree: document.getElementById('use-worktree').checked
    };
    
    // SDKオプション収集
    const sdkOptions = collectSDKOptions();
    settings.sdk = sdkOptions.sdk;
    
    // Worktree設定
    if (settings.useWorktree) {
        const branchName = document.getElementById('worktree-branch').value;
        const keepWorktree = document.getElementById('keep-worktree')?.checked;
        
        if (branchName || keepWorktree) {
            settings.worktree = {
                branchName: branchName || undefined,
                keepAfterCompletion: !!keepWorktree
            };
        }
    }
    
    return settings;
}

// プリセット保存モーダル表示
function showSavePresetModal() {
    const modal = document.getElementById('save-preset-modal');
    const form = document.getElementById('save-preset-form');
    const nameInput = document.getElementById('preset-name');
    const descInput = document.getElementById('preset-description');
    
    // フォームをリセット
    form.reset();
    
    // モーダル表示
    modal.classList.remove('hidden');
    nameInput.focus();
    
    // 既存のプリセット名を取得（重複チェック用）
    let existingNames = [];
    const presetSelector = document.getElementById('preset-selector');
    if (presetSelector) {
        Array.from(presetSelector.options).forEach(option => {
            if (option.value && option.value !== 'loading') {
                // オプションのテキストから名前を抽出（" (システム)"を除去）
                const name = option.textContent.replace(' (システム)', '').trim();
                existingNames.push(name.toLowerCase());
            }
        });
    }
    
    // 名前入力時の重複チェック
    nameInput.oninput = (e) => {
        const value = e.target.value.trim().toLowerCase();
        if (existingNames.includes(value)) {
            nameInput.setCustomValidity('この名前のプリセットは既に存在します');
            nameInput.classList.add('error');
        } else {
            nameInput.setCustomValidity('');
            nameInput.classList.remove('error');
        }
    };
    
    // フォーム送信イベント
    form.onsubmit = async (e) => {
        e.preventDefault();
        await savePreset();
    };
    
    // キャンセルボタン
    document.getElementById('cancel-save-preset').onclick = () => {
        modal.classList.add('hidden');
    };
    
    // 閉じるボタン
    modal.querySelector('.close').onclick = () => {
        modal.classList.add('hidden');
    };
}

// プリセット保存
async function savePreset() {
    const nameInput = document.getElementById('preset-name');
    const descInput = document.getElementById('preset-description');
    
    if (!nameInput || !descInput) {
        console.error('Preset input fields not found');
        return;
    }
    
    const name = nameInput.value ? nameInput.value.trim() : '';
    const description = descInput.value ? descInput.value.trim() : '';
    
    // 入力チェック
    if (!name) {
        if (typeof showError === 'function') {
            showError('プリセット名を入力してください');
        }
        return;
    }
    
    const settings = collectCurrentSettings();
    
    // デバッグ: 送信するデータを確認
    const presetData = { name, description, settings };
    console.log('Saving preset with data:', presetData);
    
    try {
        await api.createPreset(presetData);
        if (typeof showNotification === 'function') {
            showNotification('プリセットを保存しました', 'success');
        } else if (typeof showSuccess === 'function') {
            showSuccess('プリセットを保存しました');
        }
        
        // モーダルを閉じる
        document.getElementById('save-preset-modal').classList.add('hidden');
        
        // プリセット一覧を再読み込み
        await loadPresets();
        
    } catch (error) {
        console.error('Preset save error:', error);
        let errorMessage = '保存に失敗しました';
        
        // エラーメッセージをより分かりやすく
        if (error.message.includes('already exists')) {
            errorMessage = `「${name}」という名前のプリセットは既に存在します。別の名前を使用してください。`;
        } else {
            errorMessage = `保存に失敗しました: ${error.message}`;
        }
        
        if (typeof showNotification === 'function') {
            showNotification(errorMessage, 'error');
        } else if (typeof showError === 'function') {
            showError(errorMessage);
        }
    }
}

// プリセット管理モーダル表示
async function showManagePresetsModal() {
    const modal = document.getElementById('manage-presets-modal');
    const listElement = document.getElementById('preset-list');
    
    // プリセット一覧を読み込み
    try {
        const data = await api.getPresets();
        
        // リストをクリア
        listElement.innerHTML = '';
        
        // ユーザープリセットのみ表示（システムプリセットは削除不可）
        if (data.userPresets.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; color: #999;">ユーザープリセットがありません</p>';
        } else {
            data.userPresets.forEach(preset => {
                const item = createPresetItem(preset);
                listElement.appendChild(item);
            });
        }
        
        // モーダル表示
        modal.classList.remove('hidden');
        
    } catch (error) {
        showNotification('プリセット一覧の取得に失敗しました', 'error');
    }
    
    // 閉じるボタン
    modal.querySelector('.close').onclick = () => {
        modal.classList.add('hidden');
    };
}

// プリセットアイテム作成
function createPresetItem(preset) {
    const item = document.createElement('div');
    item.className = 'preset-item';
    
    item.innerHTML = `
        <div class="preset-info">
            <div class="preset-name">${preset.name}</div>
            <div class="preset-description">${preset.description || '説明なし'}</div>
        </div>
        <div class="preset-actions">
            <button class="btn btn-secondary btn-sm" onclick="applyPreset('${preset.id}')">適用</button>
            <button class="btn btn-danger btn-sm" onclick="deletePreset('${preset.id}')">削除</button>
        </div>
    `;
    
    return item;
}

// 現在選択中のプリセットを削除
// プリセット削除（HTMLのonclickから呼び出される）
async function deletePreset(presetId) {
    if (!confirm('このプリセットを削除しますか？')) {
        return;
    }
    
    try {
        await api.deletePreset(presetId);
        
        if (typeof showSuccess === 'function') {
            showSuccess('プリセットを削除しました');
        }
        
        // プリセットリストを再読み込み
        await loadPresets();
    } catch (error) {
        console.error('Failed to delete preset:', error);
        if (typeof showError === 'function') {
            showError('プリセットの削除に失敗しました');
        }
    }
}

async function deleteCurrentPreset() {
    const selector = document.getElementById('preset-selector');
    const selectedOption = selector.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) {
        return;
    }
    
    const presetName = selectedOption.textContent.replace(' (システム)', '');
    if (!confirm(`「${presetName}」を削除しますか？`)) {
        return;
    }
    
    try {
        await api.deletePreset(selectedOption.value);
        
        if (typeof showSuccess === 'function') {
            showSuccess('プリセットを削除しました');
        }
        
        // カスタム設定に戻す
        selector.value = '';
        handlePresetChange({ target: selector });
        
        // プリセット一覧を再読み込み
        await loadPresets();
        
    } catch (error) {
        if (typeof showError === 'function') {
            showError(`削除に失敗しました: ${error.message}`);
        }
    }
}

// プリセット適用（管理画面から）
async function applyPreset(presetId) {
    try {
        const preset = await api.getPreset(presetId);
        
        // セレクトボックスの値を変更
        document.getElementById('preset-selector').value = presetId;
        
        // 設定を適用
        applyPresetOptions(preset.settings);
        
        // 説明文を更新
        document.getElementById('preset-description').textContent = preset.description || '';
        
        // モーダルを閉じる
        document.getElementById('manage-presets-modal').classList.add('hidden');
        
        showNotification('プリセットを適用しました', 'success');
        
    } catch (error) {
        showNotification(`適用に失敗しました: ${error.message}`, 'error');
    }
}

// 通知表示はutils.jsの関数を使用
// スタイルの互換性のためnotification-${type}クラスを追加
const _showNotification = showNotification;
function showNotification(message, type = 'info') {
    _showNotification(message, type);
    const notification = document.querySelector('.notification');
    if (notification) {
        notification.classList.add(`notification-${type}`);
    }
}

// SDKオプションの収集
function collectSDKOptions() {
    const options = {
        sdk: {}
    };
    
    // maxTurns
    options.sdk.maxTurns = parseInt(document.getElementById('max-turns').value);
    
    // permissionMode
    const activePermission = document.querySelector('.toggle-group .toggle-btn.active');
    if (activePermission) {
        options.sdk.permissionMode = activePermission.dataset.value;
    }
    
    // systemPrompt
    const systemPrompt = document.getElementById('system-prompt').value.trim();
    if (systemPrompt) {
        options.sdk.systemPrompt = systemPrompt;
    }
    
    // ツール制限
    const allowedTools = collectTools('allowed');
    const disallowedTools = collectTools('disallowed');
    
    if (allowedTools.length > 0) {
        options.sdk.allowedTools = allowedTools;
    }
    if (disallowedTools.length > 0) {
        options.sdk.disallowedTools = disallowedTools;
    }
    
    // 高度な設定（開いている場合のみ）
    const advancedSettings = document.querySelector('.advanced-settings');
    if (advancedSettings.open) {
        // outputFormat
        const outputFormat = document.querySelector('input[name="outputFormat"]:checked');
        if (outputFormat) {
            options.sdk.outputFormat = outputFormat.value;
        }
        
        // executable
        options.sdk.executable = document.getElementById('executable').value;
        
        // mcpConfig
        const mcpConfig = document.getElementById('mcp-config').value.trim();
        if (mcpConfig) {
            try {
                options.sdk.mcpConfig = JSON.parse(mcpConfig);
            } catch (e) {
                // エラーは事前にバリデーションで表示済み
            }
        }
        
        // continueSession
        options.sdk.continueSession = document.getElementById('continue-session').checked;
        
        // verbose
        options.sdk.verbose = document.getElementById('verbose').checked;
    }
    
    return options;
}

// ツールの収集
function collectTools(type) {
    const tools = [];
    const checkboxes = document.querySelectorAll(`#${type}-tools-tab input[type="checkbox"]:checked`);
    
    checkboxes.forEach(cb => {
        tools.push(cb.value);
    });
    
    // カスタムツールの追加
    const customInput = document.getElementById(`custom-${type}-tools`);
    if (customInput && customInput.value) {
        const customTools = customInput.value.split(',').map(t => t.trim()).filter(t => t);
        tools.push(...customTools);
    }
    
    return tools;
}

// 改良版のタスク送信処理
async function handleTaskSubmitWithSDK(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const timeoutSeconds = parseInt(formData.get('timeout'));
    
    // 基本的なタスクデータ
    const taskData = {
        instruction: formData.get('instruction'),
        context: {},
        options: {
            timeout: timeoutSeconds * 1000
        }
    };
    
    // SDKオプションの収集と追加
    const sdkOptions = collectSDKOptions();
    Object.assign(taskData.options, sdkOptions);
    
    // レガシーallowedToolsの処理（後方互換性）
    // SDKオプションが優先される
    if (!taskData.options.sdk?.allowedTools) {
        const legacyAllowedTools = [];
        const checkboxes = e.target.querySelectorAll('input[name="allowedTools"]:checked');
        checkboxes.forEach(checkbox => {
            legacyAllowedTools.push(checkbox.value);
        });
        
        const customTools = formData.get('customAllowedTools');
        if (customTools) {
            const customToolsArray = customTools.split(',').map(tool => tool.trim()).filter(tool => tool);
            legacyAllowedTools.push(...customToolsArray);
        }
        
        if (legacyAllowedTools.length > 0) {
            taskData.options.allowedTools = legacyAllowedTools;
        }
    }
    
    // Worktreeオプション（既存のコードをそのまま使用）
    if (formData.get('useWorktree')) {
        taskData.options.useWorktree = true;
        
        const branchName = formData.get('worktreeBranch');
        const keepWorktree = formData.get('keepWorktree');
        
        if (branchName || keepWorktree) {
            taskData.options.worktree = {
                enabled: true,
                branchName: branchName || undefined,
                keepAfterCompletion: !!keepWorktree
            };
        }
    }
    
    // 選択されたリポジトリを取得
    const selectedRepos = Array.from(document.getElementById('repositories').selectedOptions)
        .map(option => ({ 
            name: option.text.split(' (')[0],
            path: option.value 
        }));
    
    try {
        let response;
        
        if (selectedRepos.length > 1) {
            // 複数リポジトリの場合はバッチタスクを作成
            const batchData = {
                instruction: formData.get('instruction'),
                repositories: selectedRepos,
                options: taskData.options
            };
            
            response = await apiClient.createBatchTasks(batchData);
            showSuccess(`${selectedRepos.length}件のバッチタスクを作成しました`);
            
            // バッチで作成されたタスクをリストに追加
            if (response.tasks) {
                response.tasks.forEach(task => {
                    apiClient.subscribeToTask(task.taskId);
                });
            }
        } else if (selectedRepos.length === 1) {
            // 単一リポジトリの場合は通常のタスクを作成
            taskData.context.workingDirectory = selectedRepos[0].path;
            response = await apiClient.createTask(taskData);
            showSuccess('タスクを作成しました');
            
            const taskId = response.taskId || response.id;
            // workingDirectoryを保持
            if (!response.workingDirectory && taskData.context.workingDirectory) {
                response.workingDirectory = taskData.context.workingDirectory;
            }
            currentTasks.set(taskId, response);
            apiClient.subscribeToTask(taskId);
        } else {
            showError('リポジトリを選択してください');
            return;
        }
        
        e.target.reset();
        renderTasks();
        
        // タスク一覧を再読み込み
        setTimeout(loadTasks, 1000);
    } catch (error) {
        showError(`タスクの作成に失敗しました: ${error.message}`);
    }
}

// ユーティリティ関数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// リポジトリ一覧の読み込み（改良版）
async function loadRepositoriesWithDefault() {
    try {
        const data = await apiClient.getRepositories();
        const select = document.getElementById('repositories');
        
        // 既存のオプションをクリア
        select.innerHTML = '';
        
        // リポジトリ一覧を追加
        data.repositories.forEach((repo, index) => {
            const option = document.createElement('option');
            option.value = repo.path;
            option.text = `${repo.name} (${repo.path})`;
            
            // 最初のリポジトリをデフォルト選択
            if (index === 0) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        // 選択状態の検証
        validateRepositorySelection();
        
    } catch (error) {
        console.error('Failed to load repositories:', error);
        showError('リポジトリ一覧の読み込みに失敗しました');
    }
}

// リポジトリ選択の検証
function validateRepositorySelection() {
    const select = document.getElementById('repositories');
    const selectedOptions = select.selectedOptions;
    const submitButton = document.querySelector('button[type="submit"]');
    const helpText = document.getElementById('repository-help');
    
    if (selectedOptions.length === 0) {
        select.classList.add('error');
        submitButton.disabled = true;
        
        // エラーメッセージを表示
        if (!document.getElementById('repository-error')) {
            const errorMsg = document.createElement('span');
            errorMsg.id = 'repository-error';
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'リポジトリを1つ以上選択してください';
            helpText.appendChild(errorMsg);
        }
    } else {
        select.classList.remove('error');
        submitButton.disabled = false;
        
        // エラーメッセージを削除
        const errorMsg = document.getElementById('repository-error');
        if (errorMsg) {
            errorMsg.remove();
        }
        
        // 選択数を表示
        const countText = selectedOptions.length === 1 
            ? '1つのリポジトリが選択されています' 
            : `${selectedOptions.length}つのリポジトリが選択されています`;
        
        const infoText = helpText.querySelector('.info-text');
        infoText.textContent = countText;
    }
}

// グローバル変数
let api = null;

// 初期化関数
async function init() {
    const apiKey = getApiKeyFromQuery();
    
    // APIクライアント初期化
    if (apiKey) {
        apiClient = new APIClient(window.location.origin, apiKey);
        api = apiClient; // 両方の変数名をサポート
    } else {
        // デフォルトのAPIキーを使用（環境変数から取得された値）
        apiClient = new APIClient(window.location.origin, 'hoge');
        api = apiClient;
    }
    
    // ナビゲーションリンクにクエリパラメータを引き継ぐ
    updateNavigationLinks();

    // WebSocket接続
    const ws = apiClient.connectWebSocket();
    ws.onmessage = handleWebSocketMessage;

    // 基本的なイベントリスナー設定
    setupEventListeners();
    
    // SDKオプション関連のイベントリスナー設定
    setupSDKOptionsListeners();

    // プリセット一覧を読み込み
    await loadPresets();
    
    // リポジトリ一覧を読み込み
    await loadRepositories();

    // タスク一覧を読み込み
    loadTasks();
    
    // 定期的にタスク一覧を更新（5秒ごと）
    setInterval(() => loadTasks(), 5000);
    
    // グローバル関数として公開（HTML内のonclickから呼び出すため）
    window.applyPreset = applyPreset;
    window.deletePreset = deletePreset;
    window.cancelTask = cancelTask;
}

// ナビゲーションリンク更新はutils.jsから使用

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', init);