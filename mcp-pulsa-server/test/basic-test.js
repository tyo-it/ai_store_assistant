// Basic test file for older Node.js versions
// Note: This MCP server requires Node.js 18.20.x or newer

console.log('🚀 MCP Pulsa Server - Basic Configuration Test\n');

// Check Node.js version
const nodeVersion = process.version;
console.log('Node.js version:', nodeVersion);

const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
if (majorVersion < 18) {
  console.log('❌ Error: Node.js 18.20.x or newer is required');
  console.log('Current version:', nodeVersion);
  console.log('\n📥 To upgrade Node.js:');
  console.log('1. Visit https://nodejs.org/ and download the latest LTS version');
  console.log('2. Or use a version manager like nvm:');
  console.log('   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash');
  console.log('   nvm install 18.20');
  console.log('   nvm use 18.20');
  console.log('\n🔄 After upgrading, run: npm install');
  process.exit(1);
} else {
  console.log('✅ Node.js version is compatible');
}

// Check if package.json exists
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json found');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('📦 Project:', packageJson.name);
    console.log('📄 Version:', packageJson.version);
    console.log('📄 Description:', packageJson.description);
  } catch (error) {
    console.log('❌ Error reading package.json:', error.message);
  }
} else {
  console.log('❌ package.json not found');
}

// Check if .env.example exists
const envExamplePath = path.join(__dirname, '..', '.env.example');
if (fs.existsSync(envExamplePath)) {
  console.log('✅ .env.example found');
  console.log('📋 Remember to copy .env.example to .env and configure your API credentials');
} else {
  console.log('❌ .env.example not found');
}

// Check if source files exist
const srcPath = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcPath)) {
  console.log('✅ src directory found');
  
  const files = [
    'index.js',
    'services/fazzagnAPI.js',
    'services/speechProcessor.js',
    'utils/validator.js',
    'integration/speechAssistantBridge.js'
  ];
  
  files.forEach(file => {
    const filePath = path.join(srcPath, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} (missing)`);
    }
  });
} else {
  console.log('❌ src directory not found');
}

console.log('\n📝 Next Steps:');
console.log('1. Upgrade to Node.js 18.20.x or newer');
console.log('2. Copy .env.example to .env and configure API credentials');
console.log('3. Run: npm install');
console.log('4. Start the server: npm start');

console.log('\n🎯 MCP Server Features:');
console.log('- Speech recognition for Indonesian pulsa purchase commands');
console.log('- Phone number validation for Indonesian mobile providers');
console.log('- Fazzagn API integration for pulsa transactions');
console.log('- WebSocket integration with speech-to-speech assistant');
console.log('- Support for Telkomsel, XL, Indosat, Tri, and Smartfren');

console.log('\n💬 Example Voice Commands (Indonesian):');
console.log('- "Beli pulsa 10 ribu untuk nomor 08123456789"');
console.log('- "Isi pulsa 25000 ke 08567890123"');
console.log('- "Topup pulsa lima puluh ribu nomor 08111222333"');

console.log('\n✅ Configuration check completed!');