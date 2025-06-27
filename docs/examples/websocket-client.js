#!/usr/bin/env node

import WebSocket from 'ws';

// WebSocketサーバーに接続
const ws = new WebSocket('ws://localhost:5000');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // まず認証を行う
  console.log('Authenticating...');
  ws.send(JSON.stringify({
    type: 'auth',
    payload: {
      apiKey: 'your-secret-api-key'
    }
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message:', JSON.stringify(message, null, 2));
    
    // 認証成功後、タスクIDがあればサブスクライブ
    if (message.type === 'auth:success') {
      const taskId = process.argv[2];
      if (taskId) {
        console.log(`Subscribing to task: ${taskId}`);
        ws.send(JSON.stringify({
          type: 'subscribe',
          payload: {
            taskId: taskId
          }
        }));
      } else {
        console.log('Ready to receive messages. Provide a taskId as argument to subscribe to specific task.');
      }
    }
  } catch (error) {
    console.log('Received raw message:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
});

// プロセス終了時にWebSocket接続をクリーンアップ
process.on('SIGINT', () => {
  console.log('\nClosing WebSocket connection...');
  ws.close();
  process.exit(0);
});