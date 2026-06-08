import { deepSeekProvider, isDeepSeekEnabled } from './deepSeekProvider';
import { mockGeneratedProvider, type RuntimeProvider } from './providers';

export function selectGeneratedProvider(): RuntimeProvider {
  return isDeepSeekEnabled() ? deepSeekProvider : mockGeneratedProvider;
}
