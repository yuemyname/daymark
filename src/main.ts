import { mountToday } from './views/today';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

mountToday(app);
