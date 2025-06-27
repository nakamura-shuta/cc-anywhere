# API使用例

このドキュメントでは、CC-Anywhere APIの詳細な使用例を紹介します。

## cURLを使用した例

### タスクの作成（同期実行）

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Write a simple hello world function in JavaScript"
  }'
```

### タスクの作成（非同期実行）

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Analyze the performance of bubble sort algorithm",
    "options": {
      "async": true,
      "timeout": 60000
    }
  }'
```

### 作業ディレクトリを指定してタスクを実行

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "List all TypeScript files in this directory",
    "context": {
      "workingDirectory": "/path/to/your/project"
    }
  }'
```

### 使用可能なツールを制限してタスクを実行

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Read and analyze the README file",
    "options": {
      "allowedTools": ["Read", "Glob"]
    }
  }'
```

### タスクステータスの確認

```bash
curl -X GET http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000 \
  -H "X-API-Key: your-api-key"
```

### タスクログの取得

```bash
curl -X GET http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/logs \
  -H "X-API-Key: your-api-key"
```

### タスクのキャンセル

```bash
curl -X DELETE http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000 \
  -H "X-API-Key: your-api-key"
```

### キューにタスクを追加

```bash
# 基本的なタスク
curl -X POST http://localhost:3000/api/queue/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Analyze the project structure"
  }'

# 優先度付きタスク
curl -X POST http://localhost:3000/api/queue/tasks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Fix critical bug in auth module",
    "priority": 10
  }'

# キュー統計情報の取得
curl -X GET http://localhost:3000/api/queue/stats \
  -H "X-API-Key: your-api-key"

# キューの開始
curl -X POST http://localhost:3000/api/queue/start \
  -H "X-API-Key: your-api-key"
```

## Node.jsを使用した例

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const API_KEY = 'your-api-key';

async function createTask(instruction, options = {}) {
  try {
    const response = await axios.post(
      `${API_URL}/api/tasks`,
      { 
        instruction,
        ...options
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Task created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error.response?.data || error.message);
  }
}

async function getTaskStatus(taskId) {
  try {
    const response = await axios.get(
      `${API_URL}/api/tasks/${taskId}`,
      {
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error getting task status:', error.response?.data || error.message);
  }
}

// 使用例
async function main() {
  // シンプルなタスク
  const task1 = await createTask('Calculate the factorial of 10');
  
  // 作業ディレクトリを指定したタスク
  const task2 = await createTask('List all files', {
    context: {
      workingDirectory: '/project'
    }
  });
  
  // 非同期タスク
  const task3 = await createTask('Generate a complex report', {
    options: {
      async: true,
      timeout: 120000
    }
  });
  
  // 非同期タスクのステータス確認
  if (task3 && task3.status === 'pending') {
    console.log('Checking task status...');
    const status = await getTaskStatus(task3.taskId);
    console.log('Task status:', status);
  }
}

main();
```

## Pythonを使用した例

```python
import requests
import json
import time

API_URL = 'http://localhost:3000'
API_KEY = 'your-api-key'

class CCAnywhere:
    def __init__(self, api_url=API_URL, api_key=API_KEY):
        self.api_url = api_url
        self.api_key = api_key
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
    
    def create_task(self, instruction, context=None, options=None):
        """タスクを作成して実行"""
        data = {'instruction': instruction}
        
        if context:
            data['context'] = context
        if options:
            data['options'] = options
        
        response = requests.post(
            f'{self.api_url}/api/tasks',
            headers=self.headers,
            json=data
        )
        
        if response.status_code in [201, 202]:
            return response.json()
        else:
            raise Exception(f'Error: {response.status_code} - {response.text}')
    
    def get_task_status(self, task_id):
        """タスクのステータスを取得"""
        response = requests.get(
            f'{self.api_url}/api/tasks/{task_id}',
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f'Error: {response.status_code} - {response.text}')
    
    def get_task_logs(self, task_id):
        """タスクのログを取得"""
        response = requests.get(
            f'{self.api_url}/api/tasks/{task_id}/logs',
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f'Error: {response.status_code} - {response.text}')
    
    def cancel_task(self, task_id):
        """タスクをキャンセル"""
        response = requests.delete(
            f'{self.api_url}/api/tasks/{task_id}',
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f'Error: {response.status_code} - {response.text}')
    
    def wait_for_task(self, task_id, timeout=300, poll_interval=2):
        """タスクの完了を待機"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = self.get_task_status(task_id)
            
            if status['status'] in ['completed', 'failed', 'cancelled']:
                return status
            
            time.sleep(poll_interval)
        
        raise TimeoutError(f'Task {task_id} did not complete within {timeout} seconds')

# 使用例
if __name__ == '__main__':
    cc = CCAnywhere()
    
    # シンプルなタスク（同期実行）
    result = cc.create_task('Generate a random UUID')
    print(json.dumps(result, indent=2))
    
    # 作業ディレクトリを指定したタスク
    result = cc.create_task(
        'List Python files',
        context={'workingDirectory': '/project/src'}
    )
    print(f"Result: {result['result']}")
    
    # 非同期タスク
    async_task = cc.create_task(
        'Analyze code complexity',
        options={'async': True, 'timeout': 60000}
    )
    
    print(f"Task created with ID: {async_task['taskId']}")
    print("Waiting for task completion...")
    
    # タスクの完了を待機
    final_status = cc.wait_for_task(async_task['taskId'])
    print(f"Task completed with status: {final_status['status']}")
    
    # ログを取得
    logs = cc.get_task_logs(async_task['taskId'])
    print("Task logs:")
    for log in logs['logs']:
        print(f"  - {log}")
```

## タスクキューの使用例

### JavaScript/TypeScriptでキューを操作

```javascript
class QueueManager {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
  }

  // 優先度付きタスクを追加
  async addTask(instruction, priority = 0, options = {}) {
    const response = await fetch(`${this.apiUrl}/api/queue/tasks`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        instruction,
        priority,
        ...options
      })
    });
    
    return response.json();
  }

  // バッチでタスクを追加
  async addBatch(tasks) {
    const results = [];
    for (const task of tasks) {
      const result = await this.addTask(
        task.instruction,
        task.priority,
        task.options
      );
      results.push(result);
    }
    return results;
  }

  // キューの監視
  async monitorQueue(interval = 2000) {
    const timer = setInterval(async () => {
      const stats = await this.getStats();
      console.log(`Queue: ${stats.running} running, ${stats.pending} pending`);
      
      if (stats.size === 0 && stats.running === 0) {
        clearInterval(timer);
        console.log('All tasks completed!');
      }
    }, interval);
  }

  async getStats() {
    const response = await fetch(`${this.apiUrl}/api/queue/stats`, {
      headers: { 'X-API-Key': this.apiKey }
    });
    return response.json();
  }
}

// 使用例
const queue = new QueueManager('http://localhost:5000', 'your-api-key');

// 優先度付きタスクの投入
await queue.addBatch([
  { instruction: 'Critical bug fix', priority: 100 },
  { instruction: 'Feature implementation', priority: 50 },
  { instruction: 'Code cleanup', priority: 10 }
]);

// キューの監視開始
await queue.monitorQueue();
```

### キューの動的制御

```bash
# キューを一時停止（実行中のタスクは継続）
curl -X POST http://localhost:5000/api/queue/pause \
  -H "X-API-Key: your-api-key"

# 並行実行数を増やす
curl -X PUT http://localhost:5000/api/queue/concurrency \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 5}'

# キューを再開
curl -X POST http://localhost:5000/api/queue/start \
  -H "X-API-Key: your-api-key"
```

## 高度な使用例

### バッチ処理

```python
# 複数のタスクを並列実行
tasks = [
    {'instruction': 'Calculate fibonacci(10)'},
    {'instruction': 'Generate prime numbers up to 100'},
    {'instruction': 'Sort an array of 1000 random numbers'}
]

# 全タスクを非同期で実行
task_ids = []
for task in tasks:
    result = cc.create_task(
        task['instruction'],
        options={'async': True}
    )
    task_ids.append(result['taskId'])

# 全タスクの完了を待機
results = []
for task_id in task_ids:
    result = cc.wait_for_task(task_id)
    results.append(result)

print(f"Completed {len(results)} tasks")
```

### エラーハンドリング

```javascript
async function createTaskWithRetry(instruction, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createTask(instruction);
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 指数バックオフ
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### Webhookとの統合

```javascript
const express = require('express');
const app = express();

app.post('/webhook/task-complete', express.json(), (req, res) => {
  const { taskId, status, result } = req.body;
  
  console.log(`Task ${taskId} completed with status: ${status}`);
  
  if (status === 'completed') {
    // 結果を処理
    processResult(result);
  } else if (status === 'failed') {
    // エラーを処理
    handleError(taskId);
  }
  
  res.sendStatus(200);
});
```