/**
 * Expo config plugin: wire Android release signing to personal keystore properties.
 * Keys stay outside git; properties are injected at build time (see ops/RELEASE.txt).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            // Personal / distribution keystore — never commit the store file.
            def storePath = findProperty('LUMI_UPLOAD_STORE_FILE')
            if (storePath) {
                storeFile file(storePath)
                storePassword findProperty('LUMI_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('LUMI_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('LUMI_UPLOAD_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Require the personal keystore for release; do not fall back to debug.
            if (findProperty('LUMI_UPLOAD_STORE_FILE')) {
                signingConfig signingConfigs.release
            }
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }`;

function withPersonalAndroidSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('LUMI_UPLOAD_STORE_FILE')) {
      return config;
    }

    const pattern =
      /[ \t]*signingConfigs\s*\{[\s\S]*?buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?crunchPngs[\s\S]*?\}\s*\n\s*\}/;
    const replaced = config.modResults.contents.replace(pattern, RELEASE_SIGNING_BLOCK);

    if (replaced === config.modResults.contents) {
      throw new Error(
        'withPersonalAndroidSigning: could not locate default signingConfigs/buildTypes block',
      );
    }

    config.modResults.contents = replaced;
    return config;
  });
}

module.exports = withPersonalAndroidSigning;
