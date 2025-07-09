module.exports = {
  apps: [
    {
      name: 'cc-anywhere',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      
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