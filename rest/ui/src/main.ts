import {enableProdMode} from '@angular/core';
import {AppModuleNgFactory} from './app/app.module.ngfactory';

import {environment} from './environments/environment';
import {platformBrowser} from '@angular/platform-browser';

if (environment.production) {
  enableProdMode();
}

async function main() {
  await platformBrowser().bootstrapModuleFactory(AppModuleNgFactory);
}

void main();
