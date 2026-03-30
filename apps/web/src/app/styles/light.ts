import { lightColors as colors, type PaletteOverrides } from './light.colors';
import { alpha, createTheme, getContrastRatio } from '@mui/material/styles';

const paletteOverrideKeys: (keyof PaletteOverrides)[] = [
  'primaryMain', 'secondaryMain', 'errorMain', 'warningMain',
  'infoMain', 'successMain', 'commonBlack', 'commonWhite',
];

const lightThemeOptions = {
    palette: {
      taxi: {
        main: colors.taxi,
        light: alpha(colors.taxi, 0.5),
        dark: alpha(colors.taxi, 0.9),
        contrastText: getContrastRatio(colors.taxi, '#fff') > 4.5 ? '#fff' : '#111',
      },
      scifi: {
        main: colors.scifi,
        light: alpha(colors.scifi, 0.5),
        dark: alpha(colors.scifi, 0.9),
        contrastText: getContrastRatio(colors.scifi, '#fff') > 4.5 ? '#fff' : '#111',
      },
      crime: {
        main: colors.crime,
        light: alpha(colors.crime, 0.5),
        dark: alpha(colors.crime, 0.9),
        contrastText: getContrastRatio(colors.crime, '#fff') > 4.5 ? '#fff' : '#111',
      },
      drama: {
        main: colors.drama,
        light: alpha(colors.drama, 0.5),
        dark: alpha(colors.drama, 0.9),
        contrastText: getContrastRatio(colors.drama, '#fff') > 4.5 ? '#fff' : '#111',
      },
      comedy: {
        main: colors.comedy,
        light: alpha(colors.comedy, 0.5),
        dark: alpha(colors.comedy, 0.9),
        contrastText: getContrastRatio(colors.comedy, '#fff') > 4.5 ? '#fff' : '#111',
      },
      body: {
        main: colors.background,
        light: alpha(colors.background, 0.5),
        dark: alpha(colors.background, 0.9),
        contrastText: getContrastRatio(colors.background, '#fff') > 4.5 ? '#fff' : '#111',
      },
      primary: {
        main: '#1c294a',
      },
      secondary: {
        main: '#F5F7F2' //'#20325A',
      },
      background: {
        default: "#F5F2E8", //'#F5F7F2',
        paper: '#FFFFFF', 
      },
      warning: {
        main: '#e07a5f',
      },
      info: {
        main: '#3a5ca6',
      },
      success: {
        main: '#2ecc71',
      },
      error: {
        main: '#ce4b27',
      },
      common: { black: colors.commonBlack, white: colors.commonWhite },
    },
    components: {
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: colors.secondaryMain,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          flexContainerVertical: {
            '&.MuiTabs-flexContainerVertical': {
              height: '100%',
              flexWrap: 'wrap',
              justifyContent: 'space-evenly',
            },
          },
        },
      },
 
    },
    typography: {
      fontFamily: `"Lato", sans-serif`,
      fontSize: 14,
      fontWeightLight: '300',
      fontWeightRegular: '400',
      fontWeightMedium: '700',
      fontWeightBold: '900',
      h6: {
        fontFamily: `"Lato", sans-serif`,
        fontSize: 21,
        fontWeight: 400,
        lineHeight: '28.8px',
        letterSpacing: '1.8px',
      },
    },
};

export const theme = createTheme(lightThemeOptions);

export function getLightTheme(_overrides?: Partial<PaletteOverrides>) {
  return createTheme(lightThemeOptions);
}

