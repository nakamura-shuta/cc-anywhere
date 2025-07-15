/**
 * PM2 設定ファイル
 * 
 * PM2はNode.jsアプリケーションのプロダクション向けプロセスマネージャーです。
 * この設定により以下の機能が有効になります：
 * - アプリケーションのクラスター化（負荷分散）
 * - 自動再起動（クラッシュ時やメモリ上限到達時）
 * - ログ管理（エラー、出力、統合ログ）
 * - グレースフルシャットダウン
 * - ゼロダウンタイムデプロイ
 * 
 * 使用方法：
 * - 開始: pm2 start ecosystem.config.js
 * - 再起動: pm2 restart cc-anywhere
 * - 停止: pm2 stop cc-anywhere
 * - ログ確認: pm2 logs cc-anywhere
 * - モニタリング: pm2 monit
 * 
 * 詳細: https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    {
      name: 'cc-anywhere',
      script: './dist/index.js',
      instances: 1,              // インスタンス数（'max'でCPUコア数分起動）
      exec_mode: 'cluster',      // クラスターモードで実行
      max_memory_restart: '1G',  // メモリ使用量が1GBを超えたら再起動
      
      // 環境変数
      env: {
        NODE_ENV: 'production',
      },
      
      // 開発環境用
      env_development: {
        NODE_ENV: 'development',
        watch: false,
      },
      
      // ログ設定
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // 再起動戦略
      restart_delay: 4000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // グレースフルシャットダウン
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // 追加オプション
      node_args: '--max-old-space-size=1024',
      
      // クラッシュ時の動作
      post_update: ['npm install'],
      
      // モニタリング
      instance_var: 'INSTANCE_ID',
      
      // ログ出力設定
      output_options: {
        max_line_length: 1000, // 長い行も切り詰めない
      },
      
      // 環境固有の設定
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '*.log',
        'dist',
        '.worktrees',
        'data',
        '.work'
      ],
    },
  ],
  
  // デプロイ設定（オプション）
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: process.env.DEPLOY_BRANCH || 'origin/main', // デプロイブランチを環境変数で設定可能
      repo: 'git@github.com:your-username/cc-anywhere.git',
      path: '/var/www/cc-anywhere',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};