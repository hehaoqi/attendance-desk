// Convert snake_case keys to camelCase
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert camelCase keys to snake_case
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Recursively transform all keys in an object/array
function toCamelCase(data) {
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const result = {};
    for (const key of Object.keys(data)) {
      result[snakeToCamel(key)] = toCamelCase(data[key]);
    }
    return result;
  }
  return data;
}

function toSnakeCase(data) {
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const result = {};
    for (const key of Object.keys(data)) {
      result[camelToSnake(key)] = toSnakeCase(data[key]);
    }
    return result;
  }
  return data;
}

module.exports = { toCamelCase, toSnakeCase, snakeToCamel, camelToSnake };
