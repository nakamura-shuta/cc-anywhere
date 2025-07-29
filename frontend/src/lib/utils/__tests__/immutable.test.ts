import { describe, it, expect } from 'vitest';
import {
  updateArray,
  removeFromArray,
  prependToArray,
  appendToArray,
  replaceInArray,
  moveInArray,
  sortArray,
  uniqueArray,
  mergeObject,
  updateNested
} from '../immutable';

describe('Immutable Utils', () => {
  describe('updateArray', () => {
    it('should update matching items', () => {
      const arr = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
        { id: 3, value: 'c' }
      ];
      
      const result = updateArray(
        arr,
        item => item.id === 2,
        item => ({ ...item, value: 'updated' })
      );
      
      expect(result[1].value).toBe('updated');
      expect(result).not.toBe(arr); // 新しい配列
      expect(arr[1].value).toBe('b'); // 元の配列は変更されない
    });
    
    it('should return same array if no match', () => {
      const arr = [{ id: 1 }, { id: 2 }];
      const result = updateArray(arr, item => item.id === 3, item => item);
      
      expect(result).toBe(arr); // 同じ参照
    });
  });
  
  describe('removeFromArray', () => {
    it('should remove matching items', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = removeFromArray(arr, item => item % 2 === 0);
      
      expect(result).toEqual([1, 3, 5]);
      expect(result).not.toBe(arr);
    });
    
    it('should return same array if no match', () => {
      const arr = [1, 3, 5];
      const result = removeFromArray(arr, item => item % 2 === 0);
      
      expect(result).toBe(arr);
    });
  });
  
  describe('prependToArray', () => {
    it('should add item to beginning', () => {
      const arr = [2, 3];
      const result = prependToArray(arr, 1);
      
      expect(result).toEqual([1, 2, 3]);
      expect(result).not.toBe(arr);
    });
  });
  
  describe('appendToArray', () => {
    it('should add item to end', () => {
      const arr = [1, 2];
      const result = appendToArray(arr, 3);
      
      expect(result).toEqual([1, 2, 3]);
      expect(result).not.toBe(arr);
    });
  });
  
  describe('replaceInArray', () => {
    it('should replace item at index', () => {
      const arr = ['a', 'b', 'c'];
      const result = replaceInArray(arr, 1, 'x');
      
      expect(result).toEqual(['a', 'x', 'c']);
      expect(result).not.toBe(arr);
    });
    
    it('should return same array if index out of bounds', () => {
      const arr = ['a', 'b'];
      const result = replaceInArray(arr, 5, 'x');
      
      expect(result).toBe(arr);
    });
    
    it('should return same array if item is same', () => {
      const arr = ['a', 'b', 'c'];
      const result = replaceInArray(arr, 1, 'b');
      
      expect(result).toBe(arr);
    });
  });
  
  describe('moveInArray', () => {
    it('should move item to new position', () => {
      const arr = ['a', 'b', 'c', 'd'];
      const result = moveInArray(arr, 3, 1);
      
      expect(result).toEqual(['a', 'd', 'b', 'c']);
      expect(result).not.toBe(arr);
    });
    
    it('should return same array if indices are same', () => {
      const arr = ['a', 'b', 'c'];
      const result = moveInArray(arr, 1, 1);
      
      expect(result).toBe(arr);
    });
  });
  
  describe('sortArray', () => {
    it('should sort array without mutating original', () => {
      const arr = [3, 1, 4, 1, 5];
      const result = sortArray(arr, (a, b) => a - b);
      
      expect(result).toEqual([1, 1, 3, 4, 5]);
      expect(result).not.toBe(arr);
      expect(arr).toEqual([3, 1, 4, 1, 5]); // 元の配列は変更されない
    });
  });
  
  describe('uniqueArray', () => {
    it('should remove duplicates', () => {
      const arr = [1, 2, 2, 3, 3, 3];
      const result = uniqueArray(arr);
      
      expect(result).toEqual([1, 2, 3]);
    });
    
    it('should remove duplicates by key function', () => {
      const arr = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' }, // 重複
        { id: 3, name: 'd' }
      ];
      const result = uniqueArray(arr, item => item.id);
      
      expect(result).toHaveLength(3);
      expect(result[2].id).toBe(3);
    });
  });
  
  describe('mergeObject', () => {
    it('should merge objects', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = mergeObject(obj, { b: 20, c: 30 });
      
      expect(result).toEqual({ a: 1, b: 20, c: 30 });
      expect(result).not.toBe(obj);
    });
    
    it('should return same object if no changes', () => {
      const obj = { a: 1, b: 2 };
      const result = mergeObject(obj, { a: 1 });
      
      expect(result).toBe(obj);
    });
  });
  
  describe('updateNested', () => {
    it('should update nested value', () => {
      const obj = {
        user: {
          profile: {
            name: 'John'
          }
        }
      };
      
      const result = updateNested(obj, ['user', 'profile', 'name'], 'Jane');
      
      expect(result.user.profile.name).toBe('Jane');
      expect(result).not.toBe(obj);
      expect(obj.user.profile.name).toBe('John'); // 元のオブジェクトは変更されない
    });
    
    it('should return same object if value is same', () => {
      const obj = { a: { b: 1 } };
      const result = updateNested(obj, ['a', 'b'], 1);
      
      expect(result).toBe(obj);
    });
    
    it('should create nested structure if not exists', () => {
      const obj = { a: {} };
      const result = updateNested(obj, ['a', 'b', 'c'], 'value');
      
      expect((result as any).a.b.c).toBe('value');
    });
  });
});