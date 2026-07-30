import { parseRoute } from './router';
import { mountNow } from './views/now';
import { mountPlate } from './views/plate';

const found = document.getElementById('app');
if (!found) throw new Error('#app not found');
const app: HTMLElement = found;

let cleanup: (() => void) | null = null;

function render(): void {
  cleanup?.();
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const route = parseRoute();
  document.body.setAttribute('data-route', route.name);
  cleanup = route.name === 'plate' ? mountPlate(app, route.ts) : mountNow(app);
}

window.addEventListener('hashchange', render);
render();
