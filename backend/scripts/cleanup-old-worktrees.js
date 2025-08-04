#!/usr/bin/env node

const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

async function cleanupOldWorktrees() {
  const repositoryPath = '/Users/nakamura.shuta/dev/node/test';
  const git = simpleGit(repositoryPath);
  
  console.log('Cleaning up old worktrees in:', repositoryPath);
  
  try {
    // List all worktrees
    const output = await git.raw(['worktree', 'list', '--porcelain']);
    const lines = output.split('\n').filter(line => line.trim());
    
    const worktrees = [];
    let currentWorktree = {};
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7);
      }
    }
    
    if (currentWorktree.path) {
      worktrees.push(currentWorktree);
    }
    
    // Filter cc-anywhere worktrees
    const ccAnywhereWorktrees = worktrees.filter(w => 
      w.path.includes('.worktrees/cc-anywhere-') && 
      w.path !== repositoryPath
    );
    
    console.log(`Found ${ccAnywhereWorktrees.length} cc-anywhere worktrees to clean up`);
    
    for (const worktree of ccAnywhereWorktrees) {
      console.log(`\nRemoving worktree: ${worktree.path}`);
      console.log(`Branch: ${worktree.branch}`);
      
      try {
        // Remove worktree with force
        await git.raw(['worktree', 'remove', '--force', worktree.path]);
        console.log('✓ Worktree removed');
        
        // Try to remove the directory if it still exists
        try {
          await fs.rm(worktree.path, { recursive: true, force: true });
          console.log('✓ Directory removed');
        } catch (e) {
          // Directory might already be gone
        }
        
        // Delete branch
        if (worktree.branch && worktree.branch.startsWith('cc-anywhere/')) {
          try {
            await git.raw(['branch', '-D', worktree.branch]);
            console.log('✓ Branch deleted');
          } catch (e) {
            console.log('✗ Failed to delete branch:', e.message);
          }
        }
      } catch (error) {
        console.error('✗ Failed to remove worktree:', error.message);
      }
    }
    
    console.log('\nCleanup complete!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupOldWorktrees().catch(console.error);