import { Roboto, Open_Sans, Montserrat, Courier_Prime } from 'next/font/google';

/** Screenplay body — loaded via Next so it matches PDF/Courier Prime sources reliably. */
export const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
});

export const roboto = Roboto({
  weight: '400',
  subsets: ['latin'],
});

export const openSans = Open_Sans({
    weight: '600',
    subsets: ['latin'],
});

export const montserrat = Montserrat({
    weight: '100',
    subsets: ['latin'],
});

