const fs = require('fs');

function fixFile(filePath, oldPattern, newPattern) {
  let content = fs.readFileSync(filePath, 'utf8');
  const count = content.split(oldPattern).length - 1;
  console.log(filePath + ' - occurrences of pattern: ' + count);
  if (count === 0) {
    console.log('Pattern not found in', filePath);
    return false;
  }
  content = content.split(oldPattern).join(newPattern);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', filePath, '- replaced', count, 'occurrences');
  return true;
}

// data-quality-routes.ts
fixFile(
  '/Users/heal/orion-design/orion-platform-service/src/api/data-quality-routes.ts',
  '    return handleError(reply, new ServiceUnavailableError(\'SERVICE_UNAVAILABLE\'));\n    try {',
  '    if (!service) {\n      return handleError(reply, new ServiceUnavailableError(\'SERVICE_UNAVAILABLE\'));\n    }\n    try {'
);

// vectorize-rules-routes.ts
fixFile(
  '/Users/heal/orion-design/orion-platform-service/src/api/vectorize-rules-routes.ts',
  '    return handleError(reply, new ServiceUnavailableError(\'SERVICE_UNAVAILABLE\'));\n    try {',
  '    if (!service) {\n      return handleError(reply, new ServiceUnavailableError(\'SERVICE_UNAVAILABLE\'));\n    }\n    try {'
);
