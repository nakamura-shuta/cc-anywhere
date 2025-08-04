#!/usr/bin/env node

const simpleGit = require('simple-git');
const path = require('path');

async function testWorktreeRemove() {
  const repositoryPath = '/Users/nakamura.shuta/dev/node/test';
  const worktreePath = '/Users/nakamura.shuta/dev/node/test/.worktrees/cc-anywhere-dfaee4ea-f2f1-4c1d-b41c-c51b283eeae6';
  
  const git = simpleGit(repositoryPath);
  
  console.log('Repository:', repositoryPath);
  console.log('Worktree to remove:', worktreePath);
  
  // List current worktrees
  console.log('\nCurrent worktrees:');
  try {
    const worktrees = await git.raw(['worktree', 'list']);
    console.log(worktrees);
  } catch (error) {
    console.error('Failed to list worktrees:', error);
  }
  
  // Try relative path
  const relativePath = path.relative(repositoryPath, worktreePath);
  console.log('\nRelative path:', relativePath);
  
  // Try to remove with relative path
  console.log('\nTrying to remove with relative path...');
  try {
    const result = await git.raw(['worktree', 'remove', relativePath]);
    console.log('Success with relative path:', result);
  } catch (error) {
    console.error('Failed with relative path:', error.message);
    
    // Try absolute path
    console.log('\nTrying to remove with absolute path...');
    try {
      const result2 = await git.raw(['worktree', 'remove', worktreePath]);
      console.log('Success with absolute path:', result2);
    } catch (error2) {
      console.error('Failed with absolute path:', error2.message);
    }
  }
}

testWorktreeRemove().catch(console.error);