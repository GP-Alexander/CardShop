/**
 * Divide un script T-SQL en lotes ejecutables separados por la instrucción 'GO' (insensible a mayúsculas).
 */
export function splitBatches(sqlContent: string): string[] {
  const lines = sqlContent.split(/\r?\n/);
  const batches: string[] = [];
  let currentBatch: string[] = [];

  for (const line of lines) {
    if (/^\s*GO\s*(?:--.*)?$/i.test(line)) {
      const batchText = currentBatch.join("\n").trim();
      if (batchText.length > 0) {
        batches.push(batchText);
      }
      currentBatch = [];
    } else {
      currentBatch.push(line);
    }
  }

  const finalBatch = currentBatch.join("\n").trim();
  if (finalBatch.length > 0) {
    batches.push(finalBatch);
  }

  return batches;
}
