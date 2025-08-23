export function removeVrMap(obj) {
  if (obj && typeof obj === 'object') {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (key === '_vrMap') {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removeVrMap(obj[key]);
        }
      }
    }
  }
}

export function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}

export function isEmptyValue(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') {
        // 特殊处理 PersonName
        if (value.Alphabetic !== undefined || value.Ideographic !== undefined) {
            return isEmptyValue(value.Alphabetic) &&
                  isEmptyValue(value.Ideographic) &&
                  isEmptyValue(value.Phonetic);
        }
        // 普通对象
        return Object.values(value).every(isEmptyValue);
    }
    return false; // 其他类型（如数字）不为空
}

// 修正后的 removeEmptyTags 函数
export function removeEmptyTags(obj) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (value == null) {
            // 显式跳过 null/undefined
            continue;
        } else if (typeof value === 'object') {
            
            if (Array.isArray(value)) {
                // 处理数组 (Array) - 这包括 SQ 序列
                // 1. 如果是空数组，跳过
                if (value.length === 0) {
                    continue;
                }
                
                // 2. 如果是对象数组 (如 SQ 的 Items)，递归清理每个 Item 并过滤空项
                if (typeof value[0] === 'object' && value[0] !== null) {
                    const cleanedArray = value
                        .map(item => removeEmptyTags(item)) // 递归清理每个 Item
                        .filter(item => !isEmptyValue(item)); // 过滤掉清理后为空的 Item
                    
                    // 只有清理并过滤后数组非空，才保留
                    if (cleanedArray.length > 0) {
                        cleaned[key] = cleanedArray;
                    }
                    // 如果过滤后数组为空，则不添加该 key
                } else {
                    // 3. 如果是基本类型数组 (如 US, SS, FL 等)，检查是否全为空/0？通常不为空，直接保留
                    // 但根据 isEmptyValue, 只有空数组才被视为 empty。这里我们保留非空基本类型数组。
                    // 注意: 基本类型数组的 "空" 判断可能更复杂 (如全0?)，这里按原逻辑，非空数组即保留。
                    cleaned[key] = value; // 或者也可以考虑是否要清理基本类型数组中的 "空" 值？
                }
                
            } else {
                // 处理普通对象 (非数组)
                const cleanedObj = removeEmptyTags(value);
                if (!isEmptyValue(cleanedObj)) {
                    cleaned[key] = cleanedObj;
                }
            }
            
        } else {
            // 处理基本类型 (string, number, boolean)
            if (!isEmptyValue(value)) {
                cleaned[key] = value;
            }
        }
    }
    
    return cleaned;
}