import { parseRoute } from './router';
import { mountArchive } from './views/archive';
import { mountPlate } from './views/plate';
import { mountToday } from './views/today';

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
  cleanup =
    route.name === 'archive'
      ? mountArchive(app)
      : route.name === 'plate'
        ? mountPlate(app, route.key)
        : mountToday(app);
}

window.addEventListener('hashchange', render);
render();
