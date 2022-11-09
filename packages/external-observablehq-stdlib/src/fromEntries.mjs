export default function(obj) {
  const result = {};
  for (const [key, value] of obj) {
    result[key] = value;
  }
  return result;
}
