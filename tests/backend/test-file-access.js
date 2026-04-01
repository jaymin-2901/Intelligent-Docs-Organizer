const fs = require('fs');
const path = require('path');

// Check documents folder
const documentsDir = path.join(__dirname, 'documents');
console.log('\n=== FILE ACCESS TEST ===\n');
console.log('Documents folder:', documentsDir);
console.log('Exists:', fs.existsSync(documentsDir));

// List all PDFs
function listPDFs(dir, baseDir) {
  const results = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...listPDFs(fullPath, baseDir));
    } else if (item.toLowerCase().endsWith('.pdf')) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const url = `http://localhost:5000/documents/${relativePath}`;
      results.push({
        name: item,
        path: fullPath,
        relativePath,
        url,
        size: stat.size
      });
    }
  }
  return results;
}

if (fs.existsSync(documentsDir)) {
  const pdfs = listPDFs(documentsDir, documentsDir);
  console.log('\nFound', pdfs.length, 'PDF files:\n');
  
  pdfs.forEach((pdf, i) => {
    console.log(`${i + 1}. ${pdf.name}`);
    console.log(`   Disk Path: ${pdf.path}`);
    console.log(`   URL: ${pdf.url}`);
    console.log('');
  });
  
  console.log('\n=== TEST INSTRUCTIONS ===');
  console.log('1. Start the backend: npm run dev');
  console.log('2. Open one of the URLs above in your browser');
  console.log('3. The PDF should open directly\n');
}