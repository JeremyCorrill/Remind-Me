#!/usr/bin/env node

/**
 * Cordova hook to remove the GET_ACCOUNTS permission from AndroidManifest.xml
 * before final build to avoid Google Play privacy warnings.
 */

const fs = require('fs');
const path = require('path');

module.exports = function (context) {
  const manifestPath = path.join(
    context.opts.projectRoot,
    'platforms',
    'android',
    'app',
    'src',
    'main',
    'AndroidManifest.xml'
  );

  if (fs.existsSync(manifestPath)) {
    let manifest = fs.readFileSync(manifestPath, 'utf8');

    // Remove any GET_ACCOUNTS permission entries
    const cleanedManifest = manifest.replace(
      /<uses-permission[^>]*android\.permission\.GET_ACCOUNTS[^>]*>\s*/g,
      ''
    );

    if (manifest !== cleanedManifest) {
      fs.writeFileSync(manifestPath, cleanedManifest, 'utf8');
      console.log('✅ Removed android.permission.GET_ACCOUNTS from AndroidManifest.xml');
    } else {
      console.log('ℹ️ No GET_ACCOUNTS permission found in AndroidManifest.xml');
    }
  } else {
    console.warn('⚠️ AndroidManifest.xml not found at expected location.');
  }
};
