#!/usr/bin/env node

/**
 * Simple test script for the task-groups API
 * This tests the simplified multiple task execution feature
 */

const API_BASE = 'http://localhost:5000';

async function testTaskGroups() {
  console.log('🧪 Testing Task Groups API...\n');

  // Test 1: Sequential execution
  console.log('📝 Test 1: Sequential Task Execution');
  const sequentialTest = {
    name: "Sequential Test",
    tasks: [
      {
        id: "task1",
        name: "Create file",
        instruction: "echo 'Hello World' > test-file.txt"
      },
      {
        id: "task2", 
        name: "Read file",
        instruction: "cat test-file.txt",
        dependencies: ["task1"]
      },
      {
        id: "task3",
        name: "Clean up",
        instruction: "rm test-file.txt",
        dependencies: ["task2"]
      }
    ],
    execution: {
      mode: "sequential",
      continueSession: true
    }
  };

  try {
    console.log('Sending request...');
    const response = await fetch(`${API_BASE}/api/task-groups/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sequentialTest)
    });

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`✅ Task group started: ${result.groupId}`);
      
      // Monitor progress
      console.log('\n📊 Monitoring progress...');
      await monitorTaskGroup(result.groupId);
    } else {
      console.log('❌ Failed to start task group');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  
  // Test 2: Parallel execution
  console.log('📝 Test 2: Parallel Task Execution');
  const parallelTest = {
    name: "Parallel Test",
    tasks: [
      {
        id: "check1",
        name: "Check Node version",
        instruction: "node --version"
      },
      {
        id: "check2",
        name: "Check NPM version", 
        instruction: "npm --version"
      },
      {
        id: "check3",
        name: "List current directory",
        instruction: "ls -la"
      }
    ],
    execution: {
      mode: "parallel",
      continueSession: true
    }
  };

  try {
    console.log('Sending request...');
    const response = await fetch(`${API_BASE}/api/task-groups/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(parallelTest)
    });

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`✅ Task group started: ${result.groupId}`);
      
      // Monitor progress
      console.log('\n📊 Monitoring progress...');
      await monitorTaskGroup(result.groupId);
    } else {
      console.log('❌ Failed to start task group');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function monitorTaskGroup(groupId) {
  const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_BASE}/api/task-groups/${groupId}/status`);
      const status = await response.json();

      if (response.ok) {
        console.log(`Status: ${status.status} | Progress: ${status.progress}% | Completed: ${status.completedTasks}/${status.totalTasks}`);
        
        // Show individual task status
        status.tasks.forEach(task => {
          const statusIcon = getStatusIcon(task.status);
          console.log(`  ${statusIcon} ${task.name}: ${task.status}`);
          if (task.error) {
            console.log(`    Error: ${task.error}`);
          }
        });

        if (['completed', 'failed', 'cancelled'].includes(status.status)) {
          console.log(`\n🏁 Task group ${status.status}!`);
          if (status.sessionId) {
            console.log(`📝 Session ID: ${status.sessionId}`);
          }
          break;
        }
      } else {
        console.log('❌ Error getting status:', status.message);
        break;
      }

    } catch (error) {
      console.error('❌ Monitor error:', error.message);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.log('⏱️  Monitoring timeout');
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending': return '⏳';
    case 'running': return '🔄';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '❓';
  }
}

// Run the test
if (require.main === module) {
  testTaskGroups().catch(console.error);
}

module.exports = { testTaskGroups };