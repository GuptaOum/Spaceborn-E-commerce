import type { Cta, StorefrontCategory } from '@spaceborn/web-core/storefront';
import type { AppView } from '../types';

/** Follows a Storefront Studio button: a page, or a category shelf in the catalog. */
export function followCta(
  cta: Cta,
  categories: StorefrontCategory[],
  onNavigate: (view: AppView) => void,
  onSelectCategory: (category: string) => void,
) {
  if (cta.kind === 'page') {
    onNavigate(cta.page);
    return;
  }
  const category = categories.find((c) => c.id === cta.categoryId);
  if (category) onSelectCategory(category.name);
  else onNavigate('catalog');
}
