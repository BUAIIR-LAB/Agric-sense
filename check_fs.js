const fs = require('expo-file-system');
console.log('Keys:', Object.keys(fs));
if (fs.FileSystem) console.log('FileSystem Keys:', Object.keys(fs.FileSystem));
