import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Moneywright',
    },
    links: [
      {
        text: 'GitHub',
        url: 'https://github.com/moneywright/moneywright',
      },
    ],
  };
}
