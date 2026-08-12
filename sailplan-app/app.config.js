const variant = process.env.APP_VARIANT;
let name = 'SailPlan';
let pkg = 'com.loganmartlew.sailplan';

switch (variant) {
  case 'development':
    name = 'SailPlan Dev';
    pkg = 'com.loganmartlew.sailplan.dev';
    break;
  case 'preview':
    name = 'SailPlan Preview';
    pkg = 'com.loganmartlew.sailplan.preview';
    break;
}

const appVersion = '2.0.0';
const buildNumber = 1;

export default {
  name: name,
  slug: 'sailplan',
  version: appVersion,
  owner: 'loganmartlew',
  description:
    'An app for checking angles between marks, and selecting the best sail.',
  githubUrl: 'https://github.com/loganmartlew/sailplan',
  platforms: ['android'],
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'sailplan',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  android: {
    package: pkg,
    versionCode: getAndroidVersionCode(appVersion, buildNumber),
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    config: {
      googleMaps: {
        apiKey: 'AIzaSyCjUdd7DzepEyKS3Jl2mFIX2i_U0cra69s',
      },
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-web-browser',
    'expo-file-system',
    'expo-document-picker',
    'expo-sharing',
    'expo-notifications',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow SailPlan to use your location.',
      },
    ],
    './plugins/withNmeaForegroundService',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '8ac3f863-10b2-4947-9af6-b0893ac0d10c',
    },
  },
};

function getAndroidVersionCode(appVersion, buildNumber) {
  const [major, minor, patch] = appVersion.split('.').map(Number);
  return `${major * 1000000 + minor * 10000 + patch * 100 + buildNumber}`;
}
