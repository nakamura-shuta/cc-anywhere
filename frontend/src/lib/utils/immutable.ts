/**
 * Immutableな配列更新ユーティリティ
 */

/**
 * 配列内の特定の要素を更新
 */
export function updateArray<T>(
  array: T[],
  predicate: (item: T) => boolean,
  updater: (item: T) => T
): T[] {
  let updated = false;
  const result = array.map(item => {
    if (predicate(item)) {
      updated = true;
      return updater(item);
    }
    return item;
  });
  
  // 変更がない場合は元の配列を返す（参照の同一性を保つ）
  return updated ? result : array;
}

/**
 * 配列内の特定の要素を削除
 */
export function removeFromArray<T>(
  array: T[],
  predicate: (item: T) => boolean
): T[] {
  const result = array.filter(item => !predicate(item));
  // 変更がない場合は元の配列を返す
  return result.length === array.length ? array : result;
}

/**
 * 配列の先頭に要素を追加
 */
export function prependToArray<T>(array: T[], item: T): T[] {
  return [item, ...array];
}

/**
 * 配列の末尾に要素を追加
 */
export function appendToArray<T>(array: T[], item: T): T[] {
  return [...array, item];
}

/**
 * 配列内の要素を置換
 */
export function replaceInArray<T>(
  array: T[],
  index: number,
  item: T
): T[] {
  if (index < 0 || index >= array.length) {
    return array;
  }
  
  // 要素が同じ場合は元の配列を返す
  if (array[index] === item) {
    return array;
  }
  
  const result = [...array];
  result[index] = item;
  return result;
}

/**
 * 配列内の要素を並び替え（インデックス指定）
 */
export function moveInArray<T>(
  array: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (
    fromIndex < 0 || 
    fromIndex >= array.length ||
    toIndex < 0 || 
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }
  
  const result = [...array];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}

/**
 * 配列をソート（新しい配列を返す）
 */
export function sortArray<T>(
  array: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  return [...array].sort(compareFn);
}

/**
 * 配列から重複を削除
 */
export function uniqueArray<T>(
  array: T[],
  keyFn?: (item: T) => string | number
): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }
  
  const seen = new Set<string | number>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * オブジェクトの浅いマージ
 */
export function mergeObject<T extends object>(
  target: T,
  source: Partial<T>
): T {
  // 変更がない場合は元のオブジェクトを返す
  let hasChanges = false;
  for (const key in source) {
    if (source[key] !== target[key]) {
      hasChanges = true;
      break;
    }
  }
  
  return hasChanges ? { ...target, ...source } : target;
}

/**
 * ネストしたオブジェクトの更新
 */
export function updateNested<T extends object>(
  obj: T,
  path: string[],
  value: any
): T {
  if (path.length === 0) {
    return value;
  }
  
  const [head, ...tail] = path;
  const current = (obj as any)[head];
  
  if (tail.length === 0) {
    // 最後のキー
    if ((obj as any)[head] === value) {
      return obj; // 変更なし
    }
    return { ...obj, [head]: value };
  }
  
  // 再帰的に更新
  const updated = updateNested(current || {}, tail, value);
  if (updated === current) {
    return obj; // 子オブジェクトに変更がない場合
  }
  
  return {
    ...obj,
    [head]: updated
  };
}