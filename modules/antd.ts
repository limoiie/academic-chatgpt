import { defineNuxtModule } from 'nuxt/kit';
import * as AntD from 'ant-design-vue';
import { addComponent } from '@nuxt/kit';

export default defineNuxtModule({
  async setup() {
    for (const key in AntD) {
      if (['version', 'install'].includes(key)) continue;
      await addComponent({
        filePath: 'ant-design-vue',
        name: `A${key}`,
        export: key,
      });
    }
  },
});
