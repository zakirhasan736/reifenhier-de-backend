import test from 'node:test';
import assert from 'node:assert/strict';
import router from '../src/api/product/product.routes.js';

test('product router registers all routes required by frontend data widgets', () => {
  const registeredPaths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  assert.ok(registeredPaths.includes('/'), 'missing root / route');
  assert.ok(registeredPaths.includes('/product-lists'), 'missing /product-lists route');
  assert.ok(registeredPaths.includes('/product-details/:slug'), 'missing /product-details/:slug route');
  assert.ok(registeredPaths.includes('/brand-summary'), 'missing /brand-summary route');
  assert.ok(registeredPaths.includes('/latest-products'), 'missing /latest-products route');
  assert.ok(registeredPaths.includes('/sessions-products'), 'missing /sessions-products route');
  assert.ok(registeredPaths.includes('/:slug'), 'missing fallback /:slug route');
});
