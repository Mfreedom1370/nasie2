const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'android/app/src/main/assets/www');
const files = ['PS/background.png','index.html','manifest.webmanifest','icon-192.png','icon-512.png',
 'css/style.css','css/fonts/iranyekanwebregular.woff2','css/fonts/iranyekanwebbold.woff2',
 'js/store.js','js/safety.js','js/jdate.js','js/parser.js','js/ledger.js','js/telegram.js',
 'js/liquid.js','js/app.js','js/vendor/xlsx.full.min.js','js/android.js'];
fs.mkdirSync(dest, {recursive:true});
for (const file of files) {
 const target=path.join(dest,file);fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(path.join(root,file),target);
}
let html=fs.readFileSync(path.join(dest,'index.html'),'utf8');
html=html.replace('<script src="js/store.js">','<script src="js/android.js"></script><script src="js/store.js">');
html=html.replace("if('serviceWorker' in navigator)","if(!window.NasieAndroid && 'serviceWorker' in navigator)");
html=html.replace('<meta charset="utf-8">',`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src https:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`);
fs.writeFileSync(path.join(dest,'index.html'),html);
const icon=path.join(root,'android/app/src/main/res/drawable/app_icon.png');
fs.mkdirSync(path.dirname(icon),{recursive:true});fs.copyFileSync(path.join(root,'icon-192.png'),icon);
console.log('Android offline assets prepared ('+files.length+' files).');
