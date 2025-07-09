# CC-Anywhere Web UI SDKオプション対応提案

## 1. UI設計コンセプト

### 基本方針
- **プログレッシブディスクロージャー**: 基本機能から高度な機能へ段階的に表示
- **モバイルファースト**: スマートフォンでの操作性を最優先
- **直感的な操作**: ラベル、ツールチップ、プレースホルダーで理解しやすく
- **視覚的フィードバック**: バリデーションエラーやデフォルト値を明確に表示

## 2. SDKオプションの分類と配置

### A. プリセット選択（最上部）
```html
<div class="preset-selector">
    <label>設定プリセット</label>
    <select id="preset-selector">
        <option value="">カスタム設定</option>
        <option value="basic">ベーシック（推奨）</option>
        <option value="restricted">制限モード（安全）</option>
        <option value="advanced">フルアクセス</option>
    </select>
</div>
```

### B. 基本設定（常時表示）
1. **最大ターン数（maxTurns）**
   - スライダー + 数値入力の組み合わせ
   - デフォルト: 3、範囲: 1-50
   ```html
   <div class="form-group slider-group">
       <label for="max-turns">
           最大ターン数
           <span class="current-value">3</span>
       </label>
       <input type="range" id="max-turns-slider" min="1" max="50" value="3">
       <input type="number" id="max-turns" min="1" max="50" value="3">
   </div>
   ```

2. **システムプロンプト（systemPrompt）**
   - 折りたたみ可能なテキストエリア
   - 文字数カウンター付き（最大10,000文字）
   ```html
   <div class="form-group collapsible">
       <label for="system-prompt">
           システムプロンプト（オプション）
           <span class="char-count">0 / 10,000</span>
       </label>
       <textarea id="system-prompt" rows="3" 
           placeholder="Claudeの動作を制御するプロンプト（例：専門的な回答を心がけてください）">
       </textarea>
   </div>
   ```

3. **権限モード（permissionMode）**
   - モバイルフレンドリーなトグルボタン
   ```html
   <div class="form-group">
       <label>権限モード</label>
       <div class="toggle-group" role="radiogroup">
           <button type="button" class="toggle-btn active" data-value="ask">確認する</button>
           <button type="button" class="toggle-btn" data-value="allow">許可</button>
           <button type="button" class="toggle-btn" data-value="deny">拒否</button>
           <button type="button" class="toggle-btn" data-value="plan">計画モード</button>
       </div>
   </div>
   ```

### C. ツール制限設定（改良版）
現在のallowedToolsを改良し、許可/禁止の両方を設定可能に：

```html
<div class="form-group tool-restrictions">
    <label>ツール制限</label>
    <div class="tab-container">
        <button type="button" class="tab-btn active" data-tab="allowed">許可するツール</button>
        <button type="button" class="tab-btn" data-tab="disallowed">禁止するツール</button>
    </div>
    
    <div class="tab-content active" id="allowed-tools-tab">
        <!-- 既存のチェックボックスリスト -->
    </div>
    
    <div class="tab-content" id="disallowed-tools-tab">
        <!-- 同様のチェックボックスリスト -->
    </div>
</div>
```

### D. 高度な設定（折りたたみ）
```html
<details class="advanced-settings">
    <summary class="advanced-toggle">
        <span class="icon">▶</span>
        高度な設定
    </summary>
    
    <div class="advanced-content">
        <!-- 出力形式 -->
        <div class="form-group">
            <label>出力形式（outputFormat）</label>
            <div class="radio-group">
                <label><input type="radio" name="outputFormat" value="text" checked> テキスト</label>
                <label><input type="radio" name="outputFormat" value="json"> JSON</label>
            </div>
        </div>
        
        <!-- 実行環境 -->
        <div class="form-group">
            <label for="executable">実行環境</label>
            <select id="executable">
                <option value="node">Node.js</option>
                <option value="python">Python</option>
                <option value="bash">Bash</option>
            </select>
        </div>
        
        <!-- MCP設定 -->
        <div class="form-group">
            <label for="mcp-config">
                MCP設定（JSON）
                <button type="button" class="help-btn" title="Model Context Protocol設定">?</button>
            </label>
            <textarea id="mcp-config" rows="4" class="code-input"
                placeholder='{"server-name": {"command": "path/to/server"}}'>
            </textarea>
            <div class="validation-message" id="mcp-validation"></div>
        </div>
        
        <!-- セッション管理 -->
        <div class="form-group">
            <label>
                <input type="checkbox" id="continue-session">
                前回のセッションを継続
            </label>
        </div>
        
        <!-- 詳細ログ -->
        <div class="form-group">
            <label>
                <input type="checkbox" id="verbose">
                詳細ログを表示
            </label>
        </div>
    </div>
</details>
```

## 3. モバイル対応の工夫

### タッチ操作の最適化
```css
/* タッチターゲットは最小44px */
.btn, .toggle-btn, .tab-btn {
    min-height: 44px;
    padding: 12px 20px;
}

/* スライダーのつまみを大きく */
input[type="range"]::-webkit-slider-thumb {
    width: 24px;
    height: 24px;
}

/* チェックボックスとラジオボタンを大きく */
input[type="checkbox"],
input[type="radio"] {
    width: 20px;
    height: 20px;
}
```

### レスポンシブレイアウト
```css
/* モバイル表示 */
@media (max-width: 768px) {
    /* フォームグループを縦並びに */
    .form-group {
        margin-bottom: 20px;
    }
    
    /* トグルボタンを2x2グリッドに */
    .toggle-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    
    /* スライダーと数値入力を縦並びに */
    .slider-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
}
```

## 4. JavaScript処理の更新

### プリセット機能
```javascript
const presets = {
    basic: {
        maxTurns: 3,
        permissionMode: 'ask',
        allowedTools: ['Read', 'Write', 'Edit'],
        outputFormat: 'text'
    },
    restricted: {
        maxTurns: 1,
        permissionMode: 'deny',
        allowedTools: ['Read'],
        outputFormat: 'text'
    },
    advanced: {
        maxTurns: 10,
        permissionMode: 'allow',
        allowedTools: ['*'],
        outputFormat: 'json',
        verbose: true
    }
};
```

### フォームデータの収集
```javascript
function collectSDKOptions() {
    const options = {
        sdk: {
            maxTurns: parseInt(document.getElementById('max-turns').value),
            permissionMode: document.querySelector('.toggle-btn.active').dataset.value,
            outputFormat: document.querySelector('input[name="outputFormat"]:checked').value
        }
    };
    
    // システムプロンプト
    const systemPrompt = document.getElementById('system-prompt').value.trim();
    if (systemPrompt) {
        options.sdk.systemPrompt = systemPrompt;
    }
    
    // ツール制限
    const allowedTools = collectTools('allowed');
    const disallowedTools = collectTools('disallowed');
    if (allowedTools.length > 0) options.sdk.allowedTools = allowedTools;
    if (disallowedTools.length > 0) options.sdk.disallowedTools = disallowedTools;
    
    // 高度な設定
    if (document.querySelector('.advanced-settings').open) {
        // MCP設定
        const mcpConfig = document.getElementById('mcp-config').value.trim();
        if (mcpConfig) {
            try {
                options.sdk.mcpConfig = JSON.parse(mcpConfig);
            } catch (e) {
                // バリデーションエラー表示
            }
        }
        
        // その他の設定
        options.sdk.executable = document.getElementById('executable').value;
        options.sdk.verbose = document.getElementById('verbose').checked;
        options.sdk.continueSession = document.getElementById('continue-session').checked;
    }
    
    return options;
}
```

## 5. アクセシビリティ対応

- ARIAラベルの適切な使用
- キーボードナビゲーション対応
- 色だけに依存しない情報提示
- 適切なコントラスト比の確保

## 6. 実装の優先順位

1. **Phase 1**: 基本設定（maxTurns、systemPrompt、permissionMode）
2. **Phase 2**: ツール制限の改良（allowedTools/disallowedTools）
3. **Phase 3**: プリセット機能
4. **Phase 4**: 高度な設定（MCP、セッション管理等）