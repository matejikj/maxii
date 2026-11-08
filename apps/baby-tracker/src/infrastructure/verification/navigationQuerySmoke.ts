/**
 * Import-level smoke for navigation and query cache packages. Keeping the smoke
 * in a dedicated module lets Metro/TypeScript prove resolution without wiring
 * product screens yet. Sensitive query persistence is intentionally absent.
 */
import { QueryClient } from '@tanstack/react-query';

export type NavigationSmokeModuleIds = {
  native: typeof import('@react-navigation/native');
  nativeStack: typeof import('@react-navigation/native-stack');
  bottomTabs: typeof import('@react-navigation/bottom-tabs');
};

function assertExportPresent(value: unknown, label: string): void {
  // NavigationContainer is often a forwardRef object, not a plain function.
  if (value == null) {
    throw new Error(`${label} is missing from the resolved module.`);
  }
}

export async function loadNavigationModules(): Promise<NavigationSmokeModuleIds> {
  const [native, nativeStack, bottomTabs] = await Promise.all([
    import('@react-navigation/native'),
    import('@react-navigation/native-stack'),
    import('@react-navigation/bottom-tabs'),
  ]);
  assertExportPresent(native.NavigationContainer, '@react-navigation/native.NavigationContainer');
  assertExportPresent(
    nativeStack.createNativeStackNavigator,
    '@react-navigation/native-stack.createNativeStackNavigator',
  );
  assertExportPresent(
    bottomTabs.createBottomTabNavigator,
    '@react-navigation/bottom-tabs.createBottomTabNavigator',
  );
  if (typeof nativeStack.createNativeStackNavigator !== 'function') {
    throw new Error('native-stack navigator factory missing.');
  }
  if (typeof bottomTabs.createBottomTabNavigator !== 'function') {
    throw new Error('bottom-tabs navigator factory missing.');
  }
  return { native, nativeStack, bottomTabs };
}

/**
 * QueryClient is allowed only as an in-memory read-model cache. Default options
 * disable GC-hostile infinite retention and forbid implying disk persistence.
 */
export function createDiscardableQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: 60_000,
        retry: false,
      },
    },
  });
}
